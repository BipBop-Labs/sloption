import { z } from "zod";

/**
 * Los emite el login de BetterAuth, que no pasa por el catálogo. Se suscriben
 * por webhook igual que cualquier otro: una alerta de acceso es un webhook a
 * `auth.login.v1`.
 */
export const sessionEventTypes = ["auth.login.v1", "auth.logout.v1"] as const;

export const sessionEventData = z
  .object({
    ip: z.string().nullable(),
    userAgent: z.string().nullable(),
  })
  .strict();
