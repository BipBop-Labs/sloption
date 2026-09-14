import { z } from "zod";
import { id } from "../kernel";

export const assetSchema = z
  .object({ id, mime: z.string(), content: z.string(), name: z.string() })
  .strict();
export type Asset = z.infer<typeof assetSchema>;
