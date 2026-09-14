import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { byId, id, ok } from "../kernel";
import { fieldErrors } from "./errors";
import { FieldCreated, FieldRemoved, FieldUpdated } from "./events";
import { propertySchema, propertyTypeSchema } from "./properties";
import * as fields from "./services";

const option = z
  .object({ id, label: z.string().trim().min(1).max(100) })
  .strict();
// Sale de `propertySchema` para que un tipo nuevo se agregue en un solo lugar.
// `people` queda afuera a propósito: el campo de responsables lo siembra el seed
// y su valor son perfiles, no opciones que alguien pueda escribir.
const fieldInput = propertySchema
  .omit({ id: true })
  .extend({
    type: propertyTypeSchema.exclude(["people"]),
    options: z.array(option).default([]),
  })
  .strict();

export const fieldsRouter = defineRouter({
  name: "fields",
  http: "/api/fields",
  cli: "fields",
  endpoints: {
    create: defineEndpoint({
      doc: "Crea una propiedad del tablero. Las opciones solo valen para select y multiSelect.",
      access: "admin",
      input: fieldInput,
      output: propertySchema,
      event: FieldCreated,
      errors: fieldErrors,
    }),
    update: defineEndpoint({
      doc: "Renombra una propiedad o reemplaza sus opciones, también para reordenarlas. Las tarjetas que tenían una opción quitada quedan sin ese valor.",
      access: "admin",
      input: z
        .object({
          id,
          name: z.string().trim().min(1).max(100),
          options: z.array(option),
        })
        .strict(),
      output: propertySchema,
      scope: { load: fields.byId, from: (input) => input.id },
      event: FieldUpdated,
      errors: fieldErrors,
    }),
    remove: defineEndpoint({
      doc: "Elimina una propiedad y su valor en todas las tarjetas. La que agrupa el tablero no se puede eliminar.",
      access: "admin",
      input: byId,
      output: ok,
      event: FieldRemoved,
      errors: fieldErrors,
    }),
  },
});
