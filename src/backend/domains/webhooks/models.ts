import { boolean, pgTable, primaryKey, text } from "drizzle-orm/pg-core";

export const webhooks = pgTable("webhooks", {
  id: text("id").primaryKey(),
  url: text("url").notNull(),
  /** Firma las entregas con HMAC-SHA256. Solo sale por API al crear el webhook. */
  secret: text("secret").notNull(),
  enabled: boolean("enabled").notNull().default(true),
});

/** A qué tipos de evento está suscrito cada webhook. */
export const webhookEvents = pgTable(
  "webhook_events",
  {
    webhookId: text("webhook_id")
      .notNull()
      .references(() => webhooks.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
  },
  (table) => [primaryKey({ columns: [table.webhookId, table.eventType] })],
);
