import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";

export const AssetUploaded = defineEvent("assets.uploaded.v1", {
  data: z.object({ assetId: Id, mime: z.string(), name: z.string() }).strict(),
  refreshesBoard: false,
});

export const AssetViewed = defineEvent("assets.viewed.v1", {
  data: z.object({ assetId: Id }).strict(),
  refreshesBoard: false,
});
