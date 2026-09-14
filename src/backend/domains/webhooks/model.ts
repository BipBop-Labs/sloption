import { z } from "zod";
import { id } from "../kernel";

export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
}

/** El webhook tal como sale por API: sin el secreto de la firma. */
export const webhookSchema = z
  .object({ id, url: z.url(), events: z.array(id), enabled: z.boolean() })
  .strict();
