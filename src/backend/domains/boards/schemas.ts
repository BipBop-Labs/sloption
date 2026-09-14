import { z } from "zod";
import { Profile } from "../auth/schemas";
import { CardSummary } from "../cards/schemas";
import { Field } from "../fields/schemas";
import { Id } from "../schemas";

export const Board = z.object({ id: Id, name: z.string() }).strict();
export type Board = z.infer<typeof Board>;

/** Una etapa del tablero: una columna del kanban. */
export const BoardState = z
  .object({ id: Id, label: z.string().trim().min(1).max(100) })
  .strict();
export type BoardState = z.infer<typeof BoardState>;

/** Qué tarjetas: las de esta semana, todas o las archivadas. */
export const BoardQuery = z
  .object({ view: z.enum(["week", "all", "archived"]).default("week") })
  .strict();

/** Todo lo que dibuja el tablero en una lectura. */
export const BoardView = z
  .object({
    board: Board.nullable(),
    states: z.array(BoardState),
    fields: z.array(Field),
    profiles: z.array(Profile),
    cards: z.array(CardSummary),
  })
  .strict();

/** Las etapas en su orden nuevo. Las que faltan se borran y sus tarjetas quedan sin estado. */
export const StatesChange = z.object({ states: z.array(BoardState) }).strict();
