import { QueryClient } from "@tanstack/react-query";
import type {
  Board,
  BoardState,
  Card,
  Field,
  Profile,
} from "@/backend/domains/kernel";
export interface BoardData {
  board: Board;
  /** Las etapas del tablero, en orden: son las columnas. */
  states: BoardState[];
  fields: Field[];
  profiles: Profile[];
  cards: Card[];
}
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: false, refetchOnWindowFocus: true },
  },
});
/** Por kind: el código concreto del dominio (STALE_VERSION…) no cambia el mensaje. */
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
        : (messages[data.error?.kind ?? data.code] ??
            (response.status === 401
              ? "Correo o contraseña incorrectos."
              : "No pudimos guardar. Inténtalo otra vez.")),
    );
  return data as T;
}
/** `cards.move` es `POST /api/cards/move`: la ruta por defecto de todo endpoint. */
export function action<T = unknown>(name: string, input: unknown = {}) {
  return request<T>(`/api/${name.replace(".", "/")}`, input);
}
export const boardQuery = (view: string) => ({
  queryKey: ["board", view],
  queryFn: () => action<BoardData>("boards.read", { view }),
});
export const cardQuery = (id: string) => ({
  queryKey: ["card", id],
  queryFn: () => action<Card>("cards.read", { id }),
});
export function refresh() {
  void queryClient.invalidateQueries({ queryKey: ["board"] });
  void queryClient.invalidateQueries({ queryKey: ["card"] });
  void queryClient.invalidateQueries({ queryKey: ["settings"] });
}
export function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : "No pudimos completar la operación.";
}
