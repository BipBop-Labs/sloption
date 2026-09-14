import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { byId, empty, id, ok, readEvent } from "../kernel";
import { webhookErrors } from "./errors";
import { webhookSchema } from "./model";
import * as webhooks from "./services";

const subscription = z
  .object({
    url: z.url().refine((url) => /^https?:\/\//.test(url)),
    events: z.array(id).min(1),
    enabled: z.boolean(),
  })
  .strict();

export const webhooksRouter = defineRouter({
  name: "webhooks",
  http: "/api/webhooks",
  cli: "webhooks",
  endpoints: {
    list: defineEndpoint({
      doc: "Webhooks configurados, sin su secreto.",
      access: "admin",
      input: empty,
      output: z.array(webhookSchema),
      event: { data: readEvent, refreshesBoard: false },
    }),
    create: defineEndpoint({
      doc: "Suscribe una URL a eventos (catalog read los lista). Cada entrega va firmada con HMAC-SHA256; el secreto solo se devuelve acá.",
      access: "admin",
      input: subscription,
      output: webhookSchema.extend({ secret: z.string() }),
      event: {
        data: z
          .object({ webhookId: id, url: z.string(), events: z.array(id) })
          .strict(),
        refreshesBoard: false,
      },
      errors: webhookErrors,
    }),
    update: defineEndpoint({
      doc: "Cambia URL, eventos o si está activo.",
      access: "admin",
      input: subscription.extend({ id }),
      output: webhookSchema,
      scope: { load: webhooks.byId, from: (input) => input.id },
      event: {
        data: z
          .object({
            webhookId: id,
            url: z.string(),
            events: z.array(id),
            enabled: z.boolean(),
          })
          .strict(),
        refreshesBoard: false,
      },
      errors: webhookErrors,
    }),
    remove: defineEndpoint({
      doc: "Elimina un webhook. Las entregas pendientes se cancelan.",
      access: "admin",
      input: byId,
      output: ok,
      event: {
        data: z.object({ webhookId: id }).strict(),
        refreshesBoard: false,
      },
    }),
  },
});
