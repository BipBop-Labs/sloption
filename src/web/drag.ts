/** Hit-testing del arrastre. Está acá y no en el componente porque es
 *  geometría pura sobre el DOM: se puede leer, probar y cambiar sin tocar el
 *  tablero. */
export type DropTarget = { optionId: string | null; beforeId: string | null };
/** Dónde caería la tarjeta.
 *
 *  El hueco desplaza a las vecinas, así que cambia lo que hay bajo el cursor.
 *  Si además cambiara el destino, el hueco se movería, el layout volvería atrás
 *  y el resultado parpadearía. Por eso el cursor sobre el hueco significa "ya
 *  estás en el destino" y conserva el actual: ahí se corta el ciclo. */
export function dropTargetAt(
  x: number,
  y: number,
  dragged: HTMLElement | null,
  current: DropTarget | null,
): DropTarget | null {
  const target = document
    .elementsFromPoint(x, y)
    .find(
      (element) =>
        !dragged?.contains(element) && element.closest("[data-option]"),
    );
  if (target?.closest(".drop-slot")) return current;
  const column = target?.closest<HTMLElement>("[data-option]");
  if (!column) return null;
  return {
    optionId: column.dataset.option || null,
    beforeId:
      target?.closest<HTMLElement>("[data-card-id]")?.dataset.cardId ?? null,
  };
}
/** La columna sobre la que caería, o "" para el final. Igual que las tarjetas:
 *  el cursor sobre el hueco significa "ya estás en el destino". */
export function columnDropAt(
  x: number,
  y: number,
  dragged: HTMLElement,
  current: string | null,
): string | null {
  const hit = document
    .elementsFromPoint(x, y)
    .find(
      (element) =>
        !dragged.contains(element) &&
        (element.closest("[data-option]") ||
          element.classList.contains("drop-slot")),
    );
  if (!hit) return null;
  if (hit.classList.contains("drop-slot")) return current;
  return hit.closest<HTMLElement>("[data-option]")?.dataset.option ?? null;
}
