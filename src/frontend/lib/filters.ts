import type { Card, Field } from "@/backend/domains/kernel";

/** Claves propias del tablero. Todo lo demás en la URL es un filtro,
 *  así queda `?assignees=ana,beto&priority=alta` y no un blob JSON. */
export const RESERVED = ["view", "card", "settings", "fields", "invite", "q"];
export type BoardSearch = {
  view?: string;
  card?: string;
  settings?: boolean;
  fields?: boolean;
  invite?: string;
  q?: string;
  [field: string]: unknown;
};
/** El valor vacío filtra las tarjetas que no tienen ese campo asignado. */
export const EMPTY = "-";
/** Las personas asignadas no son una propiedad del tablero: tienen su propio filtro. */
export const ASSIGNEES = "assignees";
export function activeFilter(search: BoardSearch, key: string): string[] {
  const raw = search[key];
  return typeof raw === "string" && raw ? raw.split(",").filter(Boolean) : [];
}
/** Se filtra por las propiedades con opciones. Texto, número y fecha quedan
 *  cubiertos por la búsqueda por título, y las etapas no se filtran: son las
 *  columnas, justo lo que el tablero ya muestra. */
export function filterableFields(fields: Field[]): Field[] {
  return fields.filter(
    (field) => field.type === "select" || field.type === "multiSelect",
  );
}
function hits(values: string[], wanted: string[]) {
  return values.length
    ? wanted.some((id) => values.includes(id))
    : wanted.includes(EMPTY);
}
export function matchesFilters(
  card: Pick<Card, "title" | "assignees" | "properties">,
  fields: Field[],
  search: BoardSearch,
): boolean {
  const text = String(search.q ?? "")
    .trim()
    .toLowerCase();
  if (text && !card.title.toLowerCase().includes(text)) return false;
  const people = activeFilter(search, ASSIGNEES);
  if (people.length && !hits(card.assignees, people)) return false;
  for (const field of fields) {
    const wanted = activeFilter(search, field.id);
    if (!wanted.length) continue;
    const value = card.properties[field.id];
    const has = Array.isArray(value)
      ? value
      : value == null || value === ""
        ? []
        : [String(value)];
    if (!hits(has, wanted)) return false;
  }
  return true;
}
