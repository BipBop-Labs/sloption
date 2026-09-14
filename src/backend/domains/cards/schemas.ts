import { z } from "zod";
import { Properties } from "../fields/schemas";
import { Id } from "../schemas";

export const Card = z
  .object({
    id: Id,
    boardId: Id,
    title: z.string(),
    markdown: z.string(),
    document: z.string().nullable(),
    /** La etapa: la columna del kanban. Null: sin estado. */
    stateId: Id.nullable(),
    assignees: z.array(Id),
    properties: Properties,
    weekly: z.boolean(),
    archived: z.boolean(),
    /** Etiqueta de la etapa al archivar. Copia, no referencia a la etapa. */
    archivedStage: z.string().nullable(),
    rank: z.number(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  })
  .strict();
export type Card = z.infer<typeof Card>;

/** Lo que viaja en el tablero: la tarjeta sin su cuerpo. */
export const CardSummary = Card.omit({ document: true, markdown: true });
export type CardSummary = z.infer<typeof CardSummary>;

const Title = z.string().trim().min(1).max(500);

export const NewCard = z
  .object({
    title: Title,
    stateId: Id.nullable().default(null),
    assignees: z.array(Id).default([]),
    properties: Properties.default({}),
    weekly: z.boolean().default(false),
  })
  .strict();
export type NewCard = z.infer<typeof NewCard>;

/** Título o propiedades nuevas. `version` es la de la última lectura. */
export const CardChanges = z
  .object({
    id: Id,
    version: z.number().int().positive(),
    title: Title.optional(),
    properties: Properties.optional(),
  })
  .strict();

/** Las personas asignadas, completas: reemplaza a las anteriores. */
export const Assignment = z.object({ id: Id, assignees: z.array(Id) }).strict();

export const WeeklyMark = z.object({ id: Id, weekly: z.boolean() }).strict();

export const ArchiveMark = z.object({ id: Id, archived: z.boolean() }).strict();

/** Dónde queda: en la etapa `stateId` (null: sin estado), antes de `beforeId` o al final. */
export const CardPlacement = z
  .object({
    id: Id,
    stateId: Id.nullable(),
    beforeId: Id.nullable().default(null),
  })
  .strict();

/** Una actualización Yjs del cuerpo, en base64. */
export const DocumentUpdate = z
  .object({ id: Id, update: z.string().min(1).max(3_000_000) })
  .strict();
