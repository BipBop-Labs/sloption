import { integer, pgTable, primaryKey, text } from "drizzle-orm/pg-core";
import { boards } from "../boards/models";

/** Las propiedades que define cada tablero. Sus valores viven en `cards.properties`. */
export const fields = pgTable("fields", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  type: text("type", {
    enum: ["text", "number", "date", "select", "multiSelect"],
  }).notNull(),
  position: integer("position").notNull(),
});

/** El id de una opción es único dentro de su propiedad, no entre todas. */
export const fieldOptions = pgTable(
  "field_options",
  {
    fieldId: text("field_id")
      .notNull()
      .references(() => fields.id, { onDelete: "cascade" }),
    id: text("id").notNull(),
    label: text("label").notNull(),
    position: integer("position").notNull(),
  },
  (table) => [primaryKey({ columns: [table.fieldId, table.id] })],
);
