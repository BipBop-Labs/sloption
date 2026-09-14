import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";

export const WebhooksListed = defineEvent("webhooks.listed.v1", {
  data: z.object({}).strict(),
  refreshesBoard: false,
});

export const WebhookCreated = defineEvent("webhooks.created.v1", {
  data: z
    .object({ webhookId: Id, url: z.string(), events: z.array(Id) })
    .strict(),
  refreshesBoard: false,
});

export const WebhookUpdated = defineEvent("webhooks.updated.v1", {
  data: z
    .object({
      webhookId: Id,
      url: z.string(),
      events: z.array(Id),
      enabled: z.boolean(),
    })
    .strict(),
  refreshesBoard: false,
});

export const WebhookRemoved = defineEvent("webhooks.removed.v1", {
  data: z.object({ webhookId: Id }).strict(),
  refreshesBoard: false,
});
