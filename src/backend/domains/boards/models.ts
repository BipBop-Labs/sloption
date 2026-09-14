import { integer, pgTable, text } from "drizzle-orm/pg-core";

export const boards = pgTable("boards", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
});

/** Las etapas del tablero: son sus columnas, en orden. */
export const boardStates = pgTable("board_states", {
  id: text("id").primaryKey(),
  boardId: text("board_id")
    .notNull()
    .references(() => boards.id, { onDelete: "cascade" }),
  label: text("label").notNull(),
  position: integer("position").notNull(),
});
