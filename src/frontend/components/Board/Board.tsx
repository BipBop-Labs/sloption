import "./Board.css";
import React, { useRef, useState } from "react";
import type { Card } from "@/backend/core/model";
import {
  action,
  errorMessage,
  queryClient,
  refresh,
  type BoardData,
} from "@/frontend/lib/api";
import { captureDrag, columnDropAt, type DropTarget } from "@/frontend/lib/drag";
import { reorderStages } from "@/frontend/lib/stages";
import type { Update } from "@/frontend/lib/update";
import {
  Chip,
  chipColor,
  Composer,
  DropSlot,
  Icon,
  useConfirm,
} from "@/frontend/ui";
import { CardTile } from "../CardTile/CardTile";

export function Board({
  data,
  open,
  update,
  onError,
  isAdmin,
}: {
  data: BoardData;
  open(id: string): void;
  update: Update;
  onError(message: string): void;
  isAdmin: boolean;
}) {
  const confirm = useConfirm();
  const [newStage, setNewStage] = useState("");
  /** Las columnas son las opciones del campo de agrupación: agregar y quitar
   *  una etapa es una sola acción, field.update, que además limpia el valor en
   *  las tarjetas que la usaban. */
  async function saveStages(
    options: { id: string; label: string }[],
  ): Promise<void> {
    if (!grouping) return;
    // Predicción del resultado: el tablero ya se dibuja con el orden nuevo.
    queryClient.setQueriesData<BoardData>(
      { queryKey: ["board"] },
      (cache) =>
        cache && {
          ...cache,
          fields: cache.fields.map((field) =>
            field.id === grouping.id ? { ...field, options } : field,
          ),
        },
    );
    try {
      await action("field.update", {
        id: grouping.id,
        name: grouping.name,
        options,
      });
      refresh();
    } catch (error) {
      refresh();
      onError(errorMessage(error));
    }
  }
  function moveStage(id: string, beforeId: string): void {
    if (grouping)
      void saveStages(reorderStages(grouping.options, id, beforeId));
  }
  // setDrop tiene identidad estable, así que CardTile sigue memoizado.
  const [drop, setDrop] = useState<(DropTarget & { height: number }) | null>(
    null,
  );
  /** Arrastre de columnas: el mismo gesto que las tarjetas, en horizontal y
   *  agarrando por el encabezado. La columna sale del flujo y sus vecinas
   *  abren el hueco donde caería. */
  const [columnDrop, setColumnDrop] = useState<{
    beforeId: string;
    width: number;
    height: number;
  } | null>(null);
  const columnDrag = useRef<{
    x: number;
    id: string;
    element: HTMLElement;
    active: boolean;
    moved: boolean;
    touch: boolean;
    timer?: ReturnType<typeof setTimeout>;
    width?: number;
    height?: number;
    before?: string | null;
  } | null>(null);
  const columnRelease = useRef<(() => void) | null>(null);
  function liftColumn(pointerId: number) {
    const state = columnDrag.current;
    if (!state || state.active) return;
    state.active = true;
    const rect = state.element.getBoundingClientRect();
    state.width = rect.width;
    state.height = rect.height;
    state.element.style.position = "fixed";
    state.element.style.left = `${rect.left}px`;
    state.element.style.top = `${rect.top}px`;
    state.element.style.width = `${rect.width}px`;
    state.element.classList.add("dragging");
    columnRelease.current = captureDrag(state.element, pointerId, {
      move: columnMove,
      up: columnUp,
      cancel: columnCancel,
    });
  }
  function dropColumn(state: NonNullable<typeof columnDrag.current>) {
    columnRelease.current?.();
    columnRelease.current = null;
    for (const property of ["position", "left", "top", "width", "transform"])
      state.element.style.removeProperty(property);
    state.element.classList.remove("dragging");
    if (state.active) setColumnDrop(null);
  }
  function columnMove(event: React.PointerEvent<HTMLElement> | PointerEvent) {
    const state = columnDrag.current;
    if (!state) return;
    const dx = event.clientX - state.x;
    if (Math.abs(dx) > 6) state.moved = true;
    if (!state.touch && state.moved) liftColumn(event.pointerId);
    if (state.touch && !state.active && state.moved) clearTimeout(state.timer);
    if (!state.active) return;
    state.element.style.transform = `translateX(${dx}px)`;
    const before = columnDropAt(
      event.clientX,
      event.clientY,
      state.element,
      state.before ?? null,
    );
    // Solo re-renderiza cuando el destino cambia.
    if (before !== state.before) {
      state.before = before;
      setColumnDrop(
        before === null
          ? null
          : {
              beforeId: before,
              width: state.width ?? 0,
              height: state.height ?? 0,
            },
      );
    }
  }
  function columnUp() {
    const state = columnDrag.current;
    columnDrag.current = null;
    if (!state) return;
    clearTimeout(state.timer);
    // Cae en el hueco que se mostró, no en un hit-test nuevo.
    const before = state.before ?? null;
    const move = state.active && state.moved && before !== null;
    dropColumn(state);
    if (move) moveStage(state.id, before);
  }
  function columnCancel() {
    const state = columnDrag.current;
    columnDrag.current = null;
    if (!state) return;
    clearTimeout(state.timer);
    dropColumn(state);
  }
  const grouping = data.fields.find(
    (field) => field.id === data.board.groupingId,
  );
  const options = [
    ...(grouping?.options ?? []),
    { id: "", label: "Sin estado" },
  ];
  return (
    <div id="board-content" className="board" aria-label="Tablero kanban">
      {options.map((option) => {
        const cards = data.cards.filter(
          (card) => (card.values[data.board.groupingId] ?? "") === option.id,
        );
        // "" = al final de la columna; un id = justo antes de esa tarjeta.
        const slot =
          drop && (drop.optionId ?? "") === option.id
            ? (drop.beforeId ?? "")
            : null;
        const stages = grouping?.options ?? [];
        const reorderable = isAdmin && !!grouping && !!option.id;
        return (
          <React.Fragment key={option.id}>
            {columnDrop?.beforeId === option.id && (
              <DropSlot width={columnDrop.width} height={columnDrop.height} />
            )}
            <section
              className="column"
              data-option={option.id}
              onPointerDown={(event) => {
                const target = event.target as HTMLElement;
                if (
                  !reorderable ||
                  event.button !== 0 ||
                  !target.closest(".column-header") ||
                  target.closest("button")
                )
                  return;
                const state = {
                  x: event.clientX,
                  id: option.id,
                  element: event.currentTarget,
                  active: false,
                  moved: false,
                  touch: event.pointerType === "touch",
                  timer: undefined as ReturnType<typeof setTimeout> | undefined,
                };
                columnDrag.current = state;
                if (state.touch)
                  state.timer = setTimeout(() => {
                    liftColumn(event.pointerId);
                    navigator.vibrate?.(15);
                  }, 200);
              }}
              onPointerMove={columnMove}
              onPointerUp={columnUp}
              onPointerCancel={columnCancel}
            >
              <header
                className={
                  reorderable ? "column-header draggable" : "column-header"
                }
                tabIndex={reorderable ? 0 : undefined}
                aria-description={
                  reorderable ? "Alt y flechas para mover la etapa" : undefined
                }
                onKeyDown={(event) => {
                  if (!reorderable || !event.altKey) return;
                  const at = stages.findIndex((item) => item.id === option.id);
                  if (event.key === "ArrowLeft" && at > 0) {
                    event.preventDefault();
                    moveStage(option.id, stages[at - 1]!.id);
                  } else if (
                    event.key === "ArrowRight" &&
                    at >= 0 &&
                    at < stages.length - 1
                  ) {
                    event.preventDefault();
                    moveStage(option.id, stages[at + 2]?.id ?? "");
                  }
                }}
              >
                <h2>
                  <Chip color={option.id ? chipColor(option.id) : undefined}>
                    {option.label}
                  </Chip>
                </h2>
                <span>{cards.length}</span>
                {isAdmin && option.id && (
                  <button
                    className="stage-remove"
                    aria-label={`Eliminar etapa ${option.label}`}
                    onClick={async () => {
                      if (
                        await confirm({
                          title: `¿Eliminar la etapa "${option.label}"?`,
                          // La columna muestra las tarjetas de esta vista y de
                          // este filtro; borrar la etapa toca todas. Como acá
                          // no se sabe cuántas son, siempre se pide el nombre.
                          message:
                            "Las tarjetas de esta etapa quedan sin estado, incluidas las que el filtro o la vista no muestran. No se borra ninguna. Escribe el nombre de la etapa para confirmar.",
                          confirmLabel: "Eliminar etapa",
                          destructive: true,
                          challenge: option.label,
                        })
                      )
                        void saveStages(
                          (grouping?.options ?? []).filter(
                            (item) => item.id !== option.id,
                          ),
                        );
                    }}
                  >
                    <Icon name="trash" />
                  </button>
                )}
              </header>
              <div className="cards">
                {cards.map((card) => (
                  <React.Fragment key={card.id}>
                    {slot === card.id && <DropSlot height={drop!.height} />}
                    <CardTile
                      card={card}
                      fields={data.fields}
                      profiles={data.profiles}
                      open={open}
                      update={update}
                      preview={setDrop}
                    />
                  </React.Fragment>
                ))}
                {slot === "" && <DropSlot height={drop!.height} />}
              </div>
              <Composer
                label={`Nueva tarjeta en ${option.label}`}
                submitLabel={`Crear tarjeta en ${option.label}`}
                onSubmit={async (title) => {
                  try {
                    const created = await action<Card>("card.create", {
                      title,
                      values: { [data.board.groupingId]: option.id || null },
                      weekly: true,
                    });
                    refresh();
                    // Crear es el principio de escribir la tarjeta, no el final.
                    open(created.id);
                  } catch (error) {
                    onError(errorMessage(error));
                    throw error;
                  }
                }}
              />
            </section>
          </React.Fragment>
        );
      })}
      {isAdmin && grouping && (
        <form
          className="column add-stage"
          onSubmit={(event) => {
            event.preventDefault();
            const label = newStage.trim();
            if (!label) return;
            setNewStage("");
            void saveStages([
              ...(grouping.options ?? []),
              { id: crypto.randomUUID(), label },
            ]);
          }}
        >
          <input
            value={newStage}
            onChange={(event) => setNewStage(event.target.value)}
            aria-label="Nombre de la nueva etapa"
            placeholder="Nueva etapa"
            required
          />
          <button aria-label="Agregar etapa">
            <Icon name="plus" />
            Agregar
          </button>
        </form>
      )}
    </div>
  );
}
