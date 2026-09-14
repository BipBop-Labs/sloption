import {
  boolean,
  pgTable,
  text,
  timestamp,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";

// Las tablas de BetterAuth: los nombres de tabla y columna los fija la librería.
export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
});
export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
    withTimezone: true,
  }),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
    withTimezone: true,
  }),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true }).notNull(),
});
export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt", { withTimezone: true }).notNull(),
  createdAt: timestamp("createdAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

/** Personas y agentes. Es a quien se le asignan tarjetas. */
export const profiles = pgTable("profiles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull(),
  kind: text("kind", { enum: ["person", "agent"] }).notNull(),
  theme: text("theme", { enum: ["light", "dark", "system"] }),
  /** La cuenta con la que entra. Null: una identidad sin acceso o un agente. */
  authUserId: text("auth_user_id")
    .unique()
    .references(() => user.id, { onDelete: "set null" }),
  /** Para un agente, la persona dueña de su key. */
  ownerId: text("owner_id").references((): AnyPgColumn => profiles.id, {
    onDelete: "cascade",
  }),
});

export const apiKeys = pgTable("api_keys", {
  id: text("id").primaryKey(),
  ownerId: text("owner_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  agentId: text("agent_id")
    .notNull()
    .references(() => profiles.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  /** Nunca el token: solo su hash. */
  digest: text("digest").notNull().unique(),
  revoked: boolean("revoked").notNull().default(false),
});

export const invitations = pgTable("invitations", {
  id: text("id").primaryKey(),
  /** La identidad sin acceso que liga al aceptarse. Null: crea una persona nueva. */
  profileId: text("profile_id").references(() => profiles.id, {
    onDelete: "cascade",
  }),
  email: text("email").notNull(),
  role: text("role", { enum: ["admin", "member"] }).notNull(),
  digest: text("digest").notNull().unique(),
  used: boolean("used").notNull().default(false),
});
