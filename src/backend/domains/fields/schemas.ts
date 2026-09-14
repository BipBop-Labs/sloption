import { z } from "zod";
import { Id } from "../schemas";

export const FieldType = z.enum([
  "text",
  "number",
  "date",
  "select",
  "multiSelect",
  "people",
]);
export type FieldType = z.infer<typeof FieldType>;

const Name = z.string().trim().min(1).max(100);

export const FieldOption = z.object({ id: Id, label: Name }).strict();
export type FieldOption = z.infer<typeof FieldOption>;

/** Una propiedad del tablero. Las opciones solo tienen sentido en select y multiSelect. */
export const Field = z
  .object({ id: Id, name: Name, type: FieldType, options: z.array(FieldOption) })
  .strict();
export type Field = z.infer<typeof Field>;

/** El valor de una propiedad en una tarjeta. Toda propiedad admite null. */
export const Value = z.union([
  z.string(),
  z.number().finite(),
  z.array(z.string()),
  z.null(),
]);
export type Value = z.infer<typeof Value>;

/** Los valores de una tarjeta, por id de propiedad. */
export const Values = z.record(z.string(), Value);

// `people` queda afuera a propósito: el campo de responsables lo siembra el seed
// y su valor son perfiles, no opciones que alguien pueda escribir.
export const NewField = Field.omit({ id: true })
  .extend({
    type: FieldType.exclude(["people"]),
    options: z.array(FieldOption).default([]),
  })
  .strict();

/** Nombre y opciones nuevas. Reemplazar las opciones también las reordena. */
export const FieldChanges = z
  .object({ id: Id, name: Name, options: z.array(FieldOption) })
  .strict();
