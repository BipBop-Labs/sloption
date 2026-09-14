import { and, asc, eq, notInArray } from "drizzle-orm";
import { raise } from "../../lib/errors";
import type { Tx } from "../kernel";
import { boardErrors } from "./errors";
import { boardStates, boards } from "./models";
import type { Board, BoardState } from "./schemas";

/** Hoy hay un solo tablero. Con varios por organización, esto recibe el id. */
export async function first(tx: Tx): Promise<Board | null> {
  const [board] = await tx.sql.select().from(boards).limit(1);
  return board ?? null;
}

export async function requireBoard(tx: Tx) {
  return (await first(tx)) ?? raise(boardErrors, "BOARD_NOT_FOUND");
}

export const states = (tx: Tx, boardId: string): Promise<BoardState[]> =>
  tx.sql
    .select({ id: boardStates.id, label: boardStates.label })
    .from(boardStates)
    .where(eq(boardStates.boardId, boardId))
    .orderBy(asc(boardStates.position));

/** Null es "sin estado", siempre válido. Cualquier otro tiene que ser de este tablero. */
export async function assertState(tx: Tx, boardId: string, stateId: string | null) {
  if (stateId === null) return;
  const [state] = await tx.sql
    .select({ id: boardStates.id })
    .from(boardStates)
    .where(and(eq(boardStates.id, stateId), eq(boardStates.boardId, boardId)));
  if (!state) raise(boardErrors, "STATE_NOT_FOUND");
}

/**
 * Deja las etapas en este orden. Las que faltan se borran, y la foreign key deja
 * sus tarjetas sin estado: ninguna tarjeta se borra.
 */
export async function setStates(tx: Tx, boardId: string, next: BoardState[]) {
  const ids = next.map((state) => state.id);
  if (new Set(ids).size !== ids.length) raise(boardErrors, "DUPLICATE_STATE");
  await tx.sql
    .delete(boardStates)
    .where(
      ids.length
        ? and(eq(boardStates.boardId, boardId), notInArray(boardStates.id, ids))
        : eq(boardStates.boardId, boardId),
    );
  for (const [position, state] of next.entries())
    await tx.sql
      .insert(boardStates)
      .values({ ...state, boardId, position })
      .onConflictDoUpdate({
        target: boardStates.id,
        set: { label: state.label, position },
      });
  return next;
}
