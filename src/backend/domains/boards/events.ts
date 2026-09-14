import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { id } from "../kernel";

export const BoardViewed = defineEvent("boards.viewed.v1", {
  data: z.object({ boardId: id.nullable() }).strict(),
  refreshesBoard: false,
});

export const BoardGrouped = defineEvent("boards.grouped.v1", {
  data: z.object({ boardId: id, groupingId: id }).strict(),
  refreshesBoard: true,
});
