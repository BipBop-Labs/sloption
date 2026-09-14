import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { ById, Ok } from "../schemas";
import { fieldErrors } from "./errors";
import { FieldCreated, FieldRemoved, FieldUpdated } from "./events";
import { Field, FieldChanges, NewField } from "./schemas";
import * as fields from "./services";

export const fieldsRouter = defineRouter({
  name: "fields",
  http: "/api/fields",
  cli: "fields",
  endpoints: {
    create: defineEndpoint({
      doc: "Crea una propiedad del tablero. Las opciones solo valen para select y multiSelect.",
      access: "admin",
      input: NewField,
      output: Field,
      event: FieldCreated,
      errors: fieldErrors,
    }),
    update: defineEndpoint({
      doc: "Renombra una propiedad o reemplaza sus opciones, también para reordenarlas. Las tarjetas que tenían una opción quitada quedan sin ese valor.",
      access: "admin",
      input: FieldChanges,
      output: Field,
      scope: { load: fields.byId, from: (input) => input.id },
      event: FieldUpdated,
      errors: fieldErrors,
    }),
    remove: defineEndpoint({
      doc: "Elimina una propiedad y su valor en todas las tarjetas. La que agrupa el tablero no se puede eliminar.",
      access: "admin",
      input: ById,
      output: Ok,
      event: FieldRemoved,
      errors: fieldErrors,
    }),
  },
});
