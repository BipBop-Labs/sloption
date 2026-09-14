import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";

export const BoardViewed = defineEvent("boards.viewed.v1", {
  data: z.object({ boardId: Id.nullable() }).strict(),
  refreshesBoard: false,
});

export const BoardGrouped = defineEvent("boards.grouped.v1", {
  data: z.object({ boardId: Id, groupingId: Id }).strict(),
  refreshesBoard: true,
});
