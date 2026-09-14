import { z } from "zod";
import { Id } from "../schemas";

/** Un webhook guardado. El secreto solo sale por API al crearlo: ver `WebhookSummary`. */
export const Webhook = z
  .object({
    id: Id,
    url: z.url(),
    events: z.array(Id),
    secret: z.string(),
    enabled: z.boolean(),
  })
  .strict();
export type Webhook = z.infer<typeof Webhook>;

export const WebhookSummary = Webhook.omit({ secret: true });

/** Una suscripción: la URL y los tipos de evento que le llegan. */
export const NewWebhook = z
  .object({
    url: z.url().refine((url) => /^https?:\/\//.test(url)),
    events: z.array(Id).min(1),
    enabled: z.boolean(),
  })
  .strict();
export type NewWebhook = z.infer<typeof NewWebhook>;

export const WebhookChanges = NewWebhook.extend({ id: Id });
