import { raise } from "../../lib/errors";
import * as auth from "../auth/services";
import type { Deps, Tx } from "../kernel";
import { fieldErrors, valueErrors } from "./errors";
import type { Field } from "./model";
import { parsePropertyValue } from "./properties";

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
      parsePropertyValue(field, value, profileIds);
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

export async function importMissing(tx: Tx, fields: Field[]) {
  for (const field of fields)
    if (!(await byId(tx, field.id))) await tx.put("fields", field);
}
