import { pgTable, text } from "drizzle-orm/pg-core";

/** Imágenes del cuerpo de las tarjetas. Viven en la base: el respaldo las incluye. */
export const assets = pgTable("assets", {
  id: text("id").primaryKey(),
  mime: text("mime").notNull(),
  name: text("name").notNull(),
  /** El contenido en base64, tal como llega y como se sirve. */
  content: text("content").notNull(),
});
