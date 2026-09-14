import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { boardErrors } from "../boards/errors";
import { valueErrors } from "../fields/errors";
import { byId, id, readEvent } from "../kernel";
import { cardErrors } from "./errors";
import { cardSchema, valuesSchema } from "./model";
import * as cards from "./services";

/** Toda operación sobre una tarjeta existente la carga el runner y responde NOT_FOUND. */
const card = { load: cards.byId, from: (input: { id: string }) => input.id };

export const cardsRouter = defineRouter({
  name: "cards",
  http: "/api/cards",
  cli: "cards",
  endpoints: {
    read: defineEndpoint({
      doc: "Lee una tarjeta completa: su Markdown, el documento Yjs y la version que pide cards update.",
      access: "member",
      input: byId,
      output: cardSchema,
      scope: card,
      event: { data: readEvent, refreshesBoard: false },
    }),
    create: defineEndpoint({
      doc: "Crea una tarjeta al final del tablero.",
      access: "member",
      input: z
        .object({
          title: z.string().trim().min(1).max(500),
          values: valuesSchema.default({}),
          weekly: z.boolean().default(false),
        })
        .strict(),
      output: cardSchema,
      event: {
        data: z
          .object({ cardId: id, title: z.string(), weekly: z.boolean() })
          .strict(),
        refreshesBoard: true,
      },
      errors: valueErrors,
    }),
    update: defineEndpoint({
      doc: "Cambia título o valores. Exige la version de la última lectura; si alguien más tocó la tarjeta responde STALE_VERSION: releé y reintentá.",
      access: "member",
      input: z
        .object({
          id,
          version: z.number().int().positive(),
          title: z.string().trim().min(1).max(500).optional(),
          values: valuesSchema.optional(),
        })
        .strict(),
      output: cardSchema,
      scope: card,
      event: {
        data: z
          .object({
            cardId: id,
            version: z.number().int(),
            changedFields: z.array(z.string()),
          })
          .strict(),
        refreshesBoard: true,
      },
      errors: { ...cardErrors, ...valueErrors },
    }),
    week: defineEndpoint({
      doc: "Marca o desmarca la tarjeta para esta semana.",
      access: "member",
      input: z.object({ id, weekly: z.boolean() }).strict(),
      output: cardSchema,
      scope: card,
      event: {
        data: z.object({ cardId: id, weekly: z.boolean() }).strict(),
        refreshesBoard: true,
      },
    }),
    archive: defineEndpoint({
      doc: "Archiva o restaura. Al archivar guarda la etapa como etiqueta; al restaurar vuelve a esa etapa si todavía existe.",
      access: "member",
      input: z.object({ id, archived: z.boolean() }).strict(),
      output: cardSchema,
      scope: card,
      event: {
        data: z
          .object({
            cardId: id,
            archived: z.boolean(),
            stage: z.string().nullable(),
          })
          .strict(),
        refreshesBoard: true,
      },
      errors: boardErrors,
    }),
    move: defineEndpoint({
      doc: "Mueve la tarjeta a la columna optionId (null: sin etapa), antes de beforeId o al final.",
      access: "member",
      input: z
        .object({
          id,
          optionId: id.nullable(),
          beforeId: id.nullable().default(null),
        })
        .strict(),
      output: cardSchema,
      scope: card,
      event: {
        data: z
          .object({
            cardId: id,
            fromOptionId: id.nullable(),
            toOptionId: id.nullable(),
            beforeId: id.nullable(),
          })
          .strict(),
        refreshesBoard: true,
      },
      errors: { ...cardErrors, ...valueErrors, ...boardErrors },
    }),
    applyDocument: defineEndpoint({
      doc: "Edita el cuerpo: recibe una actualización Yjs en base64 y devuelve la tarjeta con el Markdown resultante.",
      access: "member",
      input: z.object({ id, update: z.string().min(1).max(3_000_000) }).strict(),
      output: cardSchema,
      scope: card,
      event: {
        data: z.object({ cardId: id, version: z.number().int() }).strict(),
        refreshesBoard: true,
      },
      errors: cardErrors,
    }),
  },
});
