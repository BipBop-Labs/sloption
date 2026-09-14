import { z } from "zod";
import { Profile } from "../auth/schemas";
import { CardSummary } from "../cards/schemas";
import { Field } from "../fields/schemas";
import { Id } from "../schemas";

export const Board = z.object({ id: Id, name: z.string(), groupingId: Id }).strict();
export type Board = z.infer<typeof Board>;

/** Qué tarjetas: las de esta semana, todas o las archivadas. */
export const BoardQuery = z
  .object({ view: z.enum(["week", "all", "archived"]).default("week") })
  .strict();

/** Todo lo que dibuja el tablero en una lectura. */
export const BoardView = z
  .object({
    board: Board.nullable(),
    fields: z.array(Field),
    profiles: z.array(Profile),
    cards: z.array(CardSummary),
  })
  .strict();

/** La propiedad de selección simple que define las columnas. */
export const Grouping = z.object({ groupingId: Id }).strict();
