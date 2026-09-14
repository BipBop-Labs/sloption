import "./CardTile.css";
import React, { memo, useRef } from "react";
import type { Card, Field, Profile } from "@/backend/domains/kernel";
import { cardQuery, queryClient } from "@/frontend/lib/api";
import { captureDrag, dropTargetAt, type DropTarget } from "@/frontend/lib/drag";
import type { Update } from "@/frontend/lib/update";
import { Avatars, Chip, chipColor } from "@/frontend/ui";

export const CardTile = memo(function CardTile({
  card,
  fields,
  profiles,
  open,
  update,
  preview,
}: {
  card: Card;
  fields: Field[];
  profiles: Profile[];
  open(id: string): void;
  update: Update;
  preview(drop: (DropTarget & { height: number }) | null): void;
}) {
  const node = useRef<HTMLElement>(null);
  const gesture = useRef<{
    x: number;
    y: number;
    active: boolean;
    timer?: ReturnType<typeof setTimeout>;
    moved: boolean;
    touch: boolean;
    height?: number;
    drop?: DropTarget | null;
  } | null>(null);
  const release = useRef<(() => void) | null>(null);
  const prefetch = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const priority = fields.find((field) => field.id === "priority");
  const assignees = card.values.assignees;
  function start(event: React.PointerEvent<HTMLElement>) {
    if ((event.target as HTMLElement).closest("button") || event.button !== 0)
      return;
    const state = {
      x: event.clientX,
      y: event.clientY,
      active: false,
      moved: false,
      touch: event.pointerType === "touch",
      timer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
    gesture.current = state;
    if (state.touch)
      state.timer = setTimeout(() => {
        lift(event.pointerId);
        navigator.vibrate?.(15);
      }, 200);
    void queryClient.prefetchQuery(cardQuery(card.id));
  }
  /** Saca la tarjeta del flujo: su hueco desaparece y el único espacio que
   *  queda abierto es el del destino. */
  function lift(pointerId: number) {
    const state = gesture.current;
    const element = node.current;
    if (!state || !element || state.active) return;
    state.active = true;
    const rect = element.getBoundingClientRect();
    state.height = rect.height;
    element.style.position = "fixed";
    element.style.left = `${rect.left}px`;
    element.style.top = `${rect.top}px`;
    element.style.width = `${rect.width}px`;
    element.classList.add("dragging");
    release.current = captureDrag(element, pointerId, {
      move,
      up: end,
      cancel,
    });
  }
  /** Devuelve la tarjeta al flujo y borra la vista previa del hueco. */
  function drop(wasActive: boolean) {
    release.current?.();
    release.current = null;
    const element = node.current;
    if (element) {
      for (const property of ["position", "left", "top", "width", "transform"])
        element.style.removeProperty(property);
      element.classList.remove("dragging");
    }
    if (wasActive) preview(null);
  }
  function move(event: React.PointerEvent<HTMLElement> | PointerEvent) {
    const state = gesture.current;
    if (!state) return;
    const dx = event.clientX - state.x,
      dy = event.clientY - state.y;
    if (Math.hypot(dx, dy) > 6) state.moved = true;
    if (!state.touch && state.moved) lift(event.pointerId);
    if (state.touch && !state.active && state.moved) clearTimeout(state.timer);
    if (state.active && node.current) {
      node.current.style.transform = `translate(${dx}px,${dy}px)`;
      const target = dropTargetAt(
        event.clientX,
        event.clientY,
        node.current,
        state.drop ?? null,
      );
      // Solo re-renderiza cuando el destino cambia, no en cada pointermove.
      if (
        target?.optionId !== state.drop?.optionId ||
        target?.beforeId !== state.drop?.beforeId
      ) {
        state.drop = target;
        preview(target && { ...target, height: state.height ?? 0 });
      }
    }
  }
  function cancel() {
    const state = gesture.current;
    gesture.current = null;
    if (state) clearTimeout(state.timer);
    drop(!!state?.active);
  }
  function end(event: React.PointerEvent<HTMLElement> | PointerEvent) {
    const state = gesture.current;
    gesture.current = null;
    if (!state) return;
    clearTimeout(state.timer);
    // Suelta en el hueco que se mostró, no en un hit-test nuevo: lo que viste
    // es lo que pasa.
    const target = state.drop ?? null;
    drop(state.active);
    if (state.active && state.moved) {
      if (target) void update("cards.move", { id: card.id, ...target });
    } else if (
      state.touch &&
      Math.abs(event.clientX - state.x) > 70 &&
      Math.abs(event.clientY - state.y) < 40
    )
      void update(
        "cards.week",
        { id: card.id, weekly: !card.weekly },
        { weekly: !card.weekly },
      );
    else if (!state.moved) open(card.id);
  }
  return (
    <article
      ref={node}
      className="card"
      data-card-id={card.id}
      tabIndex={0}
      role="button"
      aria-label={`Abrir ${card.title}`}
      aria-description="Alt y flechas para mover la tarjeta"
      onKeyDown={(event) => {
        if (event.target !== event.currentTarget) return;
        if (
          event.altKey &&
          ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
            event.key,
          )
        ) {
          event.preventDefault();
          const column = node.current?.closest<HTMLElement>("[data-option]");
          const tiles = Array.from(
            column?.querySelectorAll<HTMLElement>("[data-card-id]") ?? [],
          );
          const index = tiles.findIndex(
            (tile) => tile.dataset.cardId === card.id,
          );
          if (event.key === "ArrowUp" || event.key === "ArrowDown") {
            if (event.key === "ArrowUp" && index <= 0) return;
            const beforeId =
              event.key === "ArrowUp"
                ? tiles[index - 1]?.dataset.cardId
                : tiles[index + 2]?.dataset.cardId;
            void update("cards.move", {
              id: card.id,
              optionId: column?.dataset.option || null,
              beforeId: beforeId ?? null,
            });
          } else {
            const target =
              event.key === "ArrowLeft"
                ? column?.previousElementSibling
                : column?.nextElementSibling;
            if (target instanceof HTMLElement)
              void update("cards.move", {
                id: card.id,
                optionId: target.dataset.option || null,
              });
          }
          return;
        }
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          open(card.id);
        }
      }}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={cancel}
      onPointerEnter={() => {
        prefetch.current = setTimeout(() => {
          void queryClient.prefetchQuery(cardQuery(card.id));
        }, 50);
      }}
      onPointerLeave={() => clearTimeout(prefetch.current)}
    >
      <h3 style={{ viewTransitionName: `title-${card.id}` }}>{card.title}</h3>
      <div className="card-meta">
        {typeof card.values.priority === "string" && (
          <Chip color={chipColor(card.values.priority)}>
            {
              priority?.options.find(
                (option) => option.id === card.values.priority,
              )?.label
            }
          </Chip>
        )}
        <Avatars
          ids={Array.isArray(assignees) ? assignees : []}
          people={profiles}
        />
        {card.weekly && <Chip variant="highlight">Esta semana</Chip>}
      </div>
    </article>
  );
});
