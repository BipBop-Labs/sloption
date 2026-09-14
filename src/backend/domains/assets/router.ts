import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { byId, id } from "../kernel";
import { AssetUploaded, AssetViewed } from "./events";
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
      event: AssetUploaded,
    }),
    read: defineEndpoint({
      doc: "La imagen como binario, con su Content-Type.",
      http: { method: "GET", path: "/:id", response: "file" },
      access: "member",
      input: byId,
      output: assetSchema,
      scope: { load: assets.byId, from: (input) => input.id },
      event: AssetViewed,
    }),
  },
});
