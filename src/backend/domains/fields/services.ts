import { z } from "zod";
import { raise } from "../../lib/errors";
import * as auth from "../auth/services";
import type { Deps, Tx } from "../kernel";
import { fieldErrors, valueErrors } from "./errors";
import type { Field, Value } from "./schemas";

export const byId = (tx: Tx, fieldId: string) => tx.get("fields", fieldId);

export async function requireField(tx: Tx, fieldId: string) {
  return (await byId(tx, fieldId)) ?? raise(fieldErrors, "FIELD_NOT_FOUND");
}

export const hasOptions = (field: Field) =>
  field.type === "select" || field.type === "multiSelect";

/** Prioridad, responsables y estado primero; el resto como estén. */
export async function ordered(tx: Tx) {
  const primary = ["priority", "assignees", "status"];
  const rank = (field: Field) =>
    primary.includes(field.id) ? primary.indexOf(field.id) : 3;
  return (await tx.list("fields")).sort((a, b) => rank(a) - rank(b));
}

/** Toda propiedad admite null. Selecciones y personas deben apuntar a ids que existen. */
export function parseValue(
  field: Field,
  value: unknown,
  assignableIds: ReadonlySet<string>,
): Value {
  if (value === null) return null;
  switch (field.type) {
    case "text":
      return z.string().max(100_000).parse(value);
    case "number":
      return z.number().finite().parse(value);
    case "date":
      return z.iso.date().parse(value);
    case "select": {
      const optionIds = new Set(field.options.map((option) => option.id));
      return z
        .string()
        .refine((id) => optionIds.has(id), "Unknown option")
        .parse(value);
    }
    case "multiSelect":
    case "people": {
      const validIds =
        field.type === "people"
          ? assignableIds
          : new Set(field.options.map((option) => option.id));
      return z
        .array(z.string().refine((id) => validIds.has(id), "Unknown reference"))
        .refine(
          (ids) => new Set(ids).size === ids.length,
          "Duplicate reference",
        )
        .parse(value);
    }
  }
}

/** Toda escritura de valores pasa por acá: tipos y referencias antes de guardar. */
export async function validateValues(
  tx: Tx,
  proposed: Record<string, unknown>,
) {
  const fields = new Map(
    (await tx.list("fields")).map((field) => [field.id, field]),
  );
  const profileIds = await auth.profileIds(tx);
  for (const [fieldId, value] of Object.entries(proposed)) {
    const field = fields.get(fieldId);
    if (!field) return raise(valueErrors, "UNKNOWN_PROPERTY");
    try {
      parseValue(field, value, profileIds);
    } catch {
      raise(valueErrors, "INVALID_VALUE", `Invalid value for ${field.name}`);
    }
  }
}

function assertUniqueOptions(options: Field["options"]) {
  if (new Set(options.map((option) => option.id)).size !== options.length)
    raise(fieldErrors, "DUPLICATE_OPTION");
}

export async function create(tx: Tx, deps: Deps, input: Omit<Field, "id">) {
  assertUniqueOptions(input.options);
  const field = { id: deps.newId(), ...input };
  await tx.put("fields", field);
  return field;
}

export async function update(
  tx: Tx,
  field: Field,
  changes: { name: string; options: Field["options"] },
) {
  assertUniqueOptions(changes.options);
  if (!hasOptions(field) && changes.options.length)
    raise(fieldErrors, "NO_OPTIONS");
  Object.assign(field, changes);
  await tx.put("fields", field);
  return field;
}

export const remove = (tx: Tx, fieldId: string) => tx.remove("fields", fieldId);
