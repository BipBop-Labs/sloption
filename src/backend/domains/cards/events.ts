import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";

export const CardViewed = defineEvent("cards.viewed.v1", {
  data: z.object({ cardId: Id }).strict(),
  refreshesBoard: false,
});

export const CardCreated = defineEvent("cards.created.v1", {
  data: z
    .object({ cardId: Id, title: z.string(), weekly: z.boolean() })
    .strict(),
  refreshesBoard: true,
});

export const CardUpdated = defineEvent("cards.updated.v1", {
  data: z
    .object({
      cardId: Id,
      version: z.number().int(),
      changedFields: z.array(z.string()),
    })
    .strict(),
  refreshesBoard: true,
});

export const CardWeeklyChanged = defineEvent("cards.weeklyChanged.v1", {
  data: z.object({ cardId: Id, weekly: z.boolean() }).strict(),
  refreshesBoard: true,
});

/** Archivar y restaurar: `stage` es la etiqueta de la etapa que tenía al archivarse. */
export const CardArchivedChanged = defineEvent("cards.archivedChanged.v1", {
  data: z
    .object({
      cardId: Id,
      archived: z.boolean(),
      stage: z.string().nullable(),
    })
    .strict(),
  refreshesBoard: true,
});

export const CardMoved = defineEvent("cards.moved.v1", {
  data: z
    .object({
      cardId: Id,
      fromOptionId: Id.nullable(),
      toOptionId: Id.nullable(),
      beforeId: Id.nullable(),
    })
    .strict(),
  refreshesBoard: true,
});

export const CardBodyEdited = defineEvent("cards.bodyEdited.v1", {
  data: z.object({ cardId: Id, version: z.number().int() }).strict(),
  refreshesBoard: true,
});
