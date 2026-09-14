import { z } from "zod";
import { id } from "../kernel";

export const valueSchema = z.union([
  z.string(),
  z.number().finite(),
  z.array(z.string()),
  z.null(),
]);
export const valuesSchema = z.record(z.string(), valueSchema);

export const cardSchema = z
  .object({
    id,
    title: z.string(),
    markdown: z.string(),
    document: z.string().nullable(),
    values: valuesSchema,
    weekly: z.boolean(),
    archived: z.boolean(),
    /** Etiqueta de la etapa al archivar. Copia, no referencia a la opción. */
    archivedStage: z.string().nullable().default(null),
    rank: z.number(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sourceId: z.string().nullable(),
    bodyMissing: z.boolean(),
  })
  .strict();
export type Card = z.infer<typeof cardSchema>;

/** Lo que viaja en el tablero: la tarjeta sin su cuerpo. */
export const cardSummarySchema = cardSchema.omit({
  document: true,
  markdown: true,
});
