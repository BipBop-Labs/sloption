import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
} from "drizzle-orm/pg-core";
import { profiles } from "../auth/models";
import { boardStates, boards } from "../boards/models";

export const cards = pgTable(
  "cards",
  {
    id: text("id").primaryKey(),
    boardId: text("board_id")
      .notNull()
      .references(() => boards.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    markdown: text("markdown").notNull().default(""),
    /** Estado Yjs del cuerpo, en base64. Null hasta que alguien lo abre en el editor. */
    document: text("document"),
    /** Borrar la etapa deja la tarjeta sin estado. */
    stateId: text("state_id").references(() => boardStates.id, {
      onDelete: "set null",
    }),
    rank: doublePrecision("rank").notNull(),
    /** Marcada para esta semana. Si no, está en el backlog. */
    weekly: boolean("weekly").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    /** Etiqueta de la etapa al archivar. Copia, no referencia: sobrevive a que la borren. */
    archivedStage: text("archived_stage"),
    /**
     * Las propiedades que define el tablero, por id de propiedad. Es el único
     * jsonb: su forma la decide cada tablero, y el servicio la valida contra
     * `fields` antes de escribir.
     */
    properties: jsonb("properties")
      .$type<Record<string, string | number | string[] | null>>()
      .notNull()
      .default({}),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("cards_board_view").on(table.boardId, table.archived, table.weekly),
  ],
);

/** A quién está asignada una tarjeta. Borrar el perfil o la tarjeta limpia la fila. */
export const cardAssignees = pgTable(
  "card_assignees",
  {
    cardId: text("card_id")
      .notNull()
      .references(() => cards.id, { onDelete: "cascade" }),
    profileId: text("profile_id")
      .notNull()
      .references(() => profiles.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.cardId, table.profileId] })],
);
