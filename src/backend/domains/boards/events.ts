import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";

export const BoardViewed = defineEvent("boards.viewed.v1", {
  data: z.object({ boardId: Id.nullable() }).strict(),
  refreshesBoard: false,
});

/** Etapas agregadas, renombradas, reordenadas o borradas. `stateIds` es el orden nuevo. */
export const BoardStatesChanged = defineEvent("boards.statesChanged.v1", {
  data: z.object({ boardId: Id, stateIds: z.array(Id) }).strict(),
  refreshesBoard: true,
});
