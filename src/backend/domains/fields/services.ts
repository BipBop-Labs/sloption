import { and, asc, eq, inArray, max, notInArray } from "drizzle-orm";
import { z } from "zod";
import { raise } from "../../lib/errors";
import type { Deps, Tx } from "../kernel";
import { fieldErrors, valueErrors } from "./errors";
import { fieldOptions, fields } from "./models";
import type { Field, FieldOption, Value } from "./schemas";

type FieldRow = typeof fields.$inferSelect;

async function withOptions(tx: Tx, rows: FieldRow[]): Promise<Field[]> {
  if (!rows.length) return [];
  const options = await tx.sql
    .select()
    .from(fieldOptions)
    .where(
      inArray(
        fieldOptions.fieldId,
        rows.map((row) => row.id),
      ),
    )
    .orderBy(asc(fieldOptions.position));
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    type: row.type,
    options: options
      .filter((option) => option.fieldId === row.id)
      .map(({ id, label }) => ({ id, label })),
  }));
}

/** Las propiedades del tablero, en su orden. */
export async function list(tx: Tx, boardId: string) {
  const rows = await tx.sql
    .select()
    .from(fields)
    .where(eq(fields.boardId, boardId))
    .orderBy(asc(fields.position));
  return withOptions(tx, rows);
}

export async function byId(tx: Tx, fieldId: string): Promise<Field | null> {
  const rows = await tx.sql.select().from(fields).where(eq(fields.id, fieldId));
  return (await withOptions(tx, rows))[0] ?? null;
}

export const hasOptions = (field: Pick<Field, "type">) =>
  field.type === "select" || field.type === "multiSelect";

/** Toda propiedad admite null. Una selección tiene que apuntar a opciones que existen. */
export function parseValue(field: Field, value: unknown): Value {
  if (value === null) return null;
  const optionIds = new Set(field.options.map((option) => option.id));
  switch (field.type) {
    case "text":
      return z.string().max(100_000).parse(value);
    case "number":
      return z.number().finite().parse(value);
    case "date":
      return z.iso.date().parse(value);
    case "select":
      return z
        .string()
        .refine((id) => optionIds.has(id), "Unknown option")
        .parse(value);
    case "multiSelect":
      return z
        .array(z.string().refine((id) => optionIds.has(id), "Unknown option"))
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Duplicate option",
        )
        .parse(value);
  }
}

/** Toda escritura de propiedades pasa por acá: tipos y opciones antes de guardar. */
export async function validateProperties(
  tx: Tx,
  boardId: string,
  proposed: Record<string, unknown>,
) {
  if (!Object.keys(proposed).length) return;
  const known = new Map((await list(tx, boardId)).map((field) => [field.id, field]));
  for (const [fieldId, value] of Object.entries(proposed)) {
    const field = known.get(fieldId);
    if (!field) return raise(valueErrors, "UNKNOWN_PROPERTY");
    try {
      parseValue(field, value);
    } catch {
      raise(valueErrors, "INVALID_VALUE", `Invalid value for ${field.name}`);
    }
  }
}

function assertOptions(type: Field["type"], options: FieldOption[]) {
  if (new Set(options.map((option) => option.id)).size !== options.length)
    raise(fieldErrors, "DUPLICATE_OPTION");
  if (!hasOptions({ type }) && options.length) raise(fieldErrors, "NO_OPTIONS");
}

/** Deja las opciones en este orden: las que faltan se borran. */
async function writeOptions(tx: Tx, fieldId: string, options: FieldOption[]) {
  const ids = options.map((option) => option.id);
  await tx.sql
    .delete(fieldOptions)
    .where(
      ids.length
        ? and(eq(fieldOptions.fieldId, fieldId), notInArray(fieldOptions.id, ids))
        : eq(fieldOptions.fieldId, fieldId),
    );
  for (const [position, option] of options.entries())
    await tx.sql
      .insert(fieldOptions)
      .values({ ...option, fieldId, position })
      .onConflictDoUpdate({
        target: [fieldOptions.fieldId, fieldOptions.id],
        set: { label: option.label, position },
      });
}

export async function create(
  tx: Tx,
  deps: Deps,
  boardId: string,
  input: Omit<Field, "id">,
): Promise<Field> {
  assertOptions(input.type, input.options);
  const [last] = await tx.sql
    .select({ position: max(fields.position) })
    .from(fields)
    .where(eq(fields.boardId, boardId));
  const field = { id: deps.newId(), ...input };
  await tx.sql.insert(fields).values({
    id: field.id,
    boardId,
    name: field.name,
    type: field.type,
    position: (last?.position ?? -1) + 1,
  });
  await writeOptions(tx, field.id, field.options);
  return field;
}

export async function update(
  tx: Tx,
  field: Field,
  changes: { name: string; options: FieldOption[] },
): Promise<Field> {
  assertOptions(field.type, changes.options);
  await tx.sql
    .update(fields)
    .set({ name: changes.name })
    .where(eq(fields.id, field.id));
  await writeOptions(tx, field.id, changes.options);
  return { ...field, ...changes };
}

export async function remove(tx: Tx, fieldId: string) {
  await tx.sql.delete(fields).where(eq(fields.id, fieldId));
}
