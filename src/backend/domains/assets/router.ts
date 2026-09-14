import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { byId, id, readEvent } from "../kernel";
import { assetSchema } from "./model";
import * as assets from "./services";

export const assetsRouter = defineRouter({
  name: "assets",
  http: "/api/assets",
  cli: "assets",
  endpoints: {
    create: defineEndpoint({
      doc: "Sube una imagen en base64. Devuelve la URL que va en el cuerpo de la tarjeta.",
      access: "member",
      input: z
        .object({
          mime: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
          name: z.string().max(300),
          content: z.string().max(7_000_000),
        })
        .strict(),
      output: z.object({ id, url: z.string() }).strict(),
      event: {
        data: z
          .object({ assetId: id, mime: z.string(), name: z.string() })
          .strict(),
        refreshesBoard: false,
      },
    }),
    read: defineEndpoint({
      doc: "La imagen como binario, con su Content-Type.",
      http: { method: "GET", path: "/:id", response: "file" },
      access: "member",
      input: byId,
      output: assetSchema,
      scope: { load: assets.byId, from: (input) => input.id },
      event: { data: readEvent, refreshesBoard: false },
    }),
  },
});
