import { useCallback } from "react";
import type { Card, Value } from "@/backend/domains/kernel";
import {
  action,
  queryClient,
  refresh,
  errorMessage,
  type BoardData,
} from "./api";

/** Invocar una acción dibujando antes su resultado. La predicción no es estado
 *  propio del frontend: es el resultado que la acción va a devolver, escrito en
 *  el caché antes de que el servidor conteste. Si falla, el caché vuelve atrás
 *  y el error sube a quien llamó (regla 3 de AGENTS.md).
 *
 *  Vive fuera de la página porque lo usan el tablero, la tarjeta y el detalle,
 *  y porque es la parte que más cuesta leer de todo el frontend. */
export type Update = (
  name: string,
  input: Record<string, unknown>,
  optimistic?: Partial<Card>,
) => Promise<void>;

export function useUpdate(showError: (message: string) => void): Update {
  return useCallback<Update>(
    async (
      name: string,
      input: Record<string, unknown>,
      optimistic?: Partial<Card>,
    ) => {
      const caches = queryClient.getQueriesData<BoardData>({
        queryKey: ["board"],
      });
      const previousCard = queryClient.getQueryData<Card>(["card", input.id]);
      if (name === "cards.update") {
        const current =
          previousCard ??
          caches
            .flatMap(([, data]) => data?.cards ?? [])
            .find((card) => card.id === input.id);
        if (current)
          optimistic = {
            ...(typeof input.title === "string" ? { title: input.title } : {}),
            values: {
              ...current.values,
              ...(input.values as Record<string, Value> | undefined),
            },
          };
      }
      if (name === "cards.move") {
        const data = caches.find(([, data]) =>
          data?.cards.some((card) => card.id === input.id),
        )?.[1];
        const current = data?.cards.find((card) => card.id === input.id);
        if (data && current) {
          const before = data.cards.find((card) => card.id === input.beforeId);
          optimistic = {
            values: {
              ...current.values,
              [data.board.groupingId]: input.optionId as Value,
            },
            rank: before
              ? before.rank - 0.5
              : Math.max(0, ...data.cards.map((card) => card.rank)) + 1024,
          };
        }
      }
      if (optimistic) {
        void queryClient.cancelQueries({ queryKey: ["board"] });
        void queryClient.cancelQueries({ queryKey: ["card", input.id] });
        if (previousCard)
          queryClient.setQueryData(["card", input.id], {
            ...previousCard,
            ...optimistic,
          });
        for (const [key, data] of caches)
          if (data)
            queryClient.setQueryData(key, {
              ...data,
              cards: data.cards
                .map((card) =>
                  card.id === input.id ? { ...card, ...optimistic } : card,
                )
                .filter((card) =>
                  key[1] === "archived"
                    ? card.archived
                    : !card.archived && (key[1] !== "week" || card.weekly),
                )
                .sort((a, b) => a.rank - b.rank),
            });
      }
      try {
        const result = await action<Card>(name, input);
        if (result.id) queryClient.setQueryData(["card", result.id], result);
        refresh();
      } catch (error) {
        if (previousCard)
          queryClient.setQueryData(["card", input.id], previousCard);
        for (const [key, data] of caches) queryClient.setQueryData(key, data);
        showError(errorMessage(error));
        refresh();
      }
    },
    [showError],
  );
}
