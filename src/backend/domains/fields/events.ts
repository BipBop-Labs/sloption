import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { id } from "../kernel";
import { propertyTypeSchema } from "./properties";

export const FieldCreated = defineEvent("fields.created.v1", {
  data: z
    .object({ fieldId: id, name: z.string(), type: propertyTypeSchema })
    .strict(),
  refreshesBoard: true,
});

/** También cuando cambia el orden de las opciones, que es el de las columnas. */
export const FieldUpdated = defineEvent("fields.updated.v1", {
  data: z
    .object({ fieldId: id, name: z.string(), optionIds: z.array(id) })
    .strict(),
  refreshesBoard: true,
});

export const FieldRemoved = defineEvent("fields.removed.v1", {
  data: z.object({ fieldId: id }).strict(),
  refreshesBoard: true,
});
