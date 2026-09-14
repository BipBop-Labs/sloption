import { z } from "zod";
import { Id } from "../schemas";

export const ImageMime = z.enum([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
]);

/** Una imagen guardada, con su contenido en base64. */
export const Asset = z
  .object({ id: Id, mime: z.string(), content: z.string(), name: z.string() })
  .strict();
export type Asset = z.infer<typeof Asset>;

export const NewAsset = z
  .object({
    mime: ImageMime,
    name: z.string().max(300),
    content: z.string().max(7_000_000),
  })
  .strict();

/** Lo que va en el cuerpo de la tarjeta. */
export const AssetLink = z.object({ id: Id, url: z.string() }).strict();
