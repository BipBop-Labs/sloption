import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { id } from "../kernel";

export const AssetUploaded = defineEvent("assets.uploaded.v1", {
  data: z.object({ assetId: id, mime: z.string(), name: z.string() }).strict(),
  refreshesBoard: false,
});

export const AssetViewed = defineEvent("assets.viewed.v1", {
  data: z.object({ assetId: id }).strict(),
  refreshesBoard: false,
});
