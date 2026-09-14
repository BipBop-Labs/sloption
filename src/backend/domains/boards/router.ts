import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { boardErrors } from "./errors";
import { BoardStatesChanged, BoardViewed } from "./events";
import { BoardQuery, BoardState, BoardView, StatesChange } from "./schemas";

export const boardsRouter = defineRouter({
  name: "boards",
  http: "/api/boards",
  cli: "boards",
  endpoints: {
    read: defineEndpoint({
      doc: "El tablero con sus etapas, propiedades, personas y tarjetas sin cuerpo. view: week (esta semana), all o archived.",
      access: "member",
      input: BoardQuery,
      output: BoardView,
      event: BoardViewed,
    }),
    setStates: defineEndpoint({
      doc: "Deja las etapas del tablero en este orden: agrega, renombra, reordena y borra. Las tarjetas de una etapa borrada quedan sin estado.",
      access: "admin",
      input: StatesChange,
      output: z.array(BoardState),
      event: BoardStatesChanged,
      errors: boardErrors,
    }),
  },
});
