import type { Card, Field } from "../core/model";

/** Claves propias del tablero. Todo lo demás en la URL es un filtro por campo,
 *  así queda `?assignees=ana,beto&priority=alta` y no un blob JSON. */
export const RESERVED = ["view", "card", "settings", "invite", "q"];
export type BoardSearch = {
  view?: string;
  card?: string;
  settings?: boolean;
  invite?: string;
  q?: string;
  [field: string]: unknown;
};
/** El valor vacío filtra las tarjetas que no tienen ese campo asignado. */
export const EMPTY = "-";
export function activeFilter(search: BoardSearch, fieldId: string): string[] {
  const raw = search[fieldId];
  return typeof raw === "string" && raw ? raw.split(",").filter(Boolean) : [];
}
/** El tablero ya agrupa por un campo: filtrar por él sería filtrar por columna,
 *  que es justo lo que el tablero muestra. Los tipos de texto libre, número y
 *  fecha piden otros controles y quedan cubiertos por la búsqueda por título. */
export function filterableFields(fields: Field[], groupingId: string): Field[] {
  return fields.filter(
    (field) =>
      field.id !== groupingId &&
      ["select", "multiSelect", "people"].includes(field.type),
  );
}
export function matchesFilters(
  card: Card,
  fields: Field[],
  search: BoardSearch,
): boolean {
  const text = String(search.q ?? "")
    .trim()
    .toLowerCase();
  if (text && !card.title.toLowerCase().includes(text)) return false;
  for (const field of fields) {
    const wanted = activeFilter(search, field.id);
    if (!wanted.length) continue;
    const value = card.values[field.id];
    const has = Array.isArray(value)
      ? value
      : value == null || value === ""
        ? []
        : [String(value)];
    const hit = has.length
      ? wanted.some((id) => has.includes(id))
      : wanted.includes(EMPTY);
    if (!hit) return false;
  }
  return true;
}
