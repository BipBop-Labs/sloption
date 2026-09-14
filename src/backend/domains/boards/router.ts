import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { profileSchema } from "../auth/model";
import { cardSummarySchema } from "../cards/model";
import { fieldErrors } from "../fields/errors";
import { propertySchema } from "../fields/model";
import { id } from "../kernel";
import { boardErrors } from "./errors";
import { BoardGrouped, BoardViewed } from "./events";
import { boardSchema } from "./model";

export const boardsRouter = defineRouter({
  name: "boards",
  http: "/api/boards",
  cli: "boards",
  endpoints: {
    read: defineEndpoint({
      doc: "El tablero con sus propiedades, personas y tarjetas sin cuerpo. view: week (esta semana), all o archived.",
      access: "member",
      input: z
        .object({
          view: z.enum(["week", "all", "archived"]).default("week"),
        })
        .strict(),
      output: z
        .object({
          board: boardSchema.nullable(),
          fields: z.array(propertySchema),
          profiles: z.array(profileSchema),
          cards: z.array(cardSummarySchema),
        })
        .strict(),
      event: BoardViewed,
    }),
    configure: defineEndpoint({
      doc: "Elige la propiedad de selección simple que define las columnas.",
      access: "admin",
      input: z.object({ groupingId: id }).strict(),
      output: boardSchema,
      event: BoardGrouped,
      errors: { ...boardErrors, ...fieldErrors },
    }),
  },
});
