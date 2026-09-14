import type { Field } from "@/backend/domains/kernel";

/** Devuelve las etapas con `id` movida justo antes de `beforeId`; con un
 *  destino que no existe (por ejemplo "", la columna sin estado), al final.
 *  "Antes de la vecina" y no "en el índice N": el índice cambia al sacar la
 *  etapa de la lista, el destino que se dibujó no. */
export function reorderStages(
  options: Field["options"],
  id: string,
  beforeId: string,
): Field["options"] {
  const moved = options.find((item) => item.id === id);
  if (!moved) return options;
  const rest = options.filter((item) => item.id !== id);
  const at = rest.findIndex((item) => item.id === beforeId);
  rest.splice(at < 0 ? rest.length : at, 0, moved);
  return rest;
}
