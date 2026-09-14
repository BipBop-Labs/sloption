import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { ById } from "../schemas";
import { AssetUploaded, AssetViewed } from "./events";
import { Asset, AssetLink, NewAsset } from "./schemas";
import * as assets from "./services";

export const assetsRouter = defineRouter({
  name: "assets",
  http: "/api/assets",
  cli: "assets",
  endpoints: {
    create: defineEndpoint({
      doc: "Sube una imagen en base64. Devuelve la URL que va en el cuerpo de la tarjeta.",
      access: "member",
      input: NewAsset,
      output: AssetLink,
      event: AssetUploaded,
    }),
    read: defineEndpoint({
      doc: "La imagen como binario, con su Content-Type.",
      http: { method: "GET", path: "/:id", response: "file" },
      access: "member",
      input: ById,
      output: Asset,
      scope: { load: assets.byId, from: (input) => input.id },
      event: AssetViewed,
    }),
  },
});
