import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { ById, Empty, Ok } from "../schemas";
import { webhookErrors } from "./errors";
import {
  WebhookCreated,
  WebhookRemoved,
  WebhookUpdated,
  WebhooksListed,
} from "./events";
import {
  NewWebhook,
  Webhook,
  WebhookChanges,
  WebhookSummary,
} from "./schemas";
import * as webhooks from "./services";

export const webhooksRouter = defineRouter({
  name: "webhooks",
  http: "/api/webhooks",
  cli: "webhooks",
  endpoints: {
    list: defineEndpoint({
      doc: "Webhooks configurados, sin su secreto.",
      access: "admin",
      input: Empty,
      output: z.array(WebhookSummary),
      event: WebhooksListed,
    }),
    create: defineEndpoint({
      doc: "Suscribe una URL a eventos (catalog read los lista). Cada entrega va firmada con HMAC-SHA256; el secreto solo se devuelve acá.",
      access: "admin",
      input: NewWebhook,
      output: Webhook,
      event: WebhookCreated,
      errors: webhookErrors,
    }),
    update: defineEndpoint({
      doc: "Cambia URL, eventos o si está activo.",
      access: "admin",
      input: WebhookChanges,
      output: WebhookSummary,
      scope: { load: webhooks.byId, from: (input) => input.id },
      event: WebhookUpdated,
      errors: webhookErrors,
    }),
    remove: defineEndpoint({
      doc: "Elimina un webhook. Las entregas pendientes se cancelan.",
      access: "admin",
      input: ById,
      output: Ok,
      event: WebhookRemoved,
    }),
  },
});
