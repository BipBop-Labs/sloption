import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { fieldErrors } from "../fields/errors";
import { boardErrors } from "./errors";
import { BoardGrouped, BoardViewed } from "./events";
import { Board, BoardQuery, BoardView, Grouping } from "./schemas";

export const boardsRouter = defineRouter({
  name: "boards",
  http: "/api/boards",
  cli: "boards",
  endpoints: {
    read: defineEndpoint({
      doc: "El tablero con sus propiedades, personas y tarjetas sin cuerpo. view: week (esta semana), all o archived.",
      access: "member",
      input: BoardQuery,
      output: BoardView,
      event: BoardViewed,
    }),
    configure: defineEndpoint({
      doc: "Elige la propiedad de selección simple que define las columnas.",
      access: "admin",
      input: Grouping,
      output: Board,
      event: BoardGrouped,
      errors: { ...boardErrors, ...fieldErrors },
    }),
  },
});
