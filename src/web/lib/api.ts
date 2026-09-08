import { QueryClient } from "@tanstack/react-query";
import type { Card, Field, Profile, Board } from "@/core/model";
export interface BoardData {
  board: Board;
  fields: Field[];
  profiles: Profile[];
  cards: Card[];
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: true },
  },
});
const messages: Record<string, string> = {
  UNAUTHENTICATED: "Inicia sesión para continuar.",
  FORBIDDEN: "No tienes permiso para hacer esto.",
  INVALID_INPUT: "Revisa los datos ingresados.",
  NOT_FOUND: "No encontramos ese elemento.",
  CONFLICT:
    "Alguien cambió estos datos. Conservamos tu edición: revisa la versión actual y vuelve a guardar.",
};
export async function request<T>(path: string, input?: unknown): Promise<T> {
  const response = await fetch(path, {
    method: input === undefined ? "GET" : "POST",
    credentials: "same-origin",
    headers: input === undefined ? {} : { "Content-Type": "application/json" },
    body: input === undefined ? undefined : JSON.stringify(input),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      response.status === 429
        ? "Demasiados intentos. Espera un minuto y vuelve a intentar."
        : (messages[data.error?.code ?? data.code] ??
            (response.status === 401
              ? "Correo o contraseña incorrectos."
              : "No pudimos guardar. Inténtalo otra vez.")),
    );
  return data as T;
}
export function action<T = unknown>(name: string, input: unknown = {}) {
  return request<T>(`/api/actions/${name}`, input);
}
export const boardQuery = (view: string) => ({
  queryKey: ["board", view],
  queryFn: () => action<BoardData>("board.read", { view }),
});
export const cardQuery = (id: string) => ({
  queryKey: ["card", id],
  queryFn: () => action<Card>("card.read", { id }),
});
export function refresh() {
  void queryClient.invalidateQueries({ queryKey: ["board"] });
  void queryClient.invalidateQueries({ queryKey: ["card"] });
  void queryClient.invalidateQueries({ queryKey: ["settings"] });
  void queryClient.invalidateQueries({ queryKey: ["history"] });
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}
