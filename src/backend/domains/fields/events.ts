import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";
import { FieldType } from "./schemas";

export const FieldCreated = defineEvent("fields.created.v1", {
  data: z.object({ fieldId: Id, name: z.string(), type: FieldType }).strict(),
  refreshesBoard: true,
});

/** También cuando cambia el orden de las opciones, que es el de las columnas. */
export const FieldUpdated = defineEvent("fields.updated.v1", {
  data: z
    .object({ fieldId: Id, name: z.string(), optionIds: z.array(Id) })
    .strict(),
  refreshesBoard: true,
});

export const FieldRemoved = defineEvent("fields.removed.v1", {
  data: z.object({ fieldId: Id }).strict(),
  refreshesBoard: true,
});
