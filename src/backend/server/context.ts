import { Pool } from "pg";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import { createStore } from "../adapters/postgres/store";
import { documents } from "../adapters/documents/yjs";
import { deliver } from "../adapters/webhooks/deliver";
import { authConfiguration } from "./auth-options";
import { createCatalog } from "../lib/catalog";
import type { Publish } from "../lib/ports";
import type { Deps, Tx } from "../domains/kernel";
import { assetsOrchestrator } from "../domains/assets/orchestrator";
import { createAuthenticator } from "../domains/auth/authenticator";
import { sessionEvents } from "../domains/auth/events";
import * as authModels from "../domains/auth/models";
import { authOrchestrators } from "../domains/auth/orchestrator";
import type { Actor } from "../domains/auth/schemas";
import { sessionEvent } from "../domains/auth/services";
import { boardsOrchestrator } from "../domains/boards/orchestrator";
import { cardsOrchestrator } from "../domains/cards/orchestrator";
import { fieldsOrchestrator } from "../domains/fields/orchestrator";
import { webhooksOrchestrator } from "../domains/webhooks/orchestrator";
import { subscribers } from "../domains/webhooks/services";

if (
  !process.env.DATABASE_URL ||
  !process.env.BETTER_AUTH_SECRET ||
  !process.env.APP_URL
)
  throw new Error("DATABASE_URL, BETTER_AUTH_SECRET and APP_URL are required");
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 12,
});
export const store = createStore(pool);
const secrets = {
  create: () => randomBytes(32).toString("base64url"),
  digest: (value: string) => createHash("sha256").update(value).digest("hex"),
};
export const auth = betterAuth({
  ...authConfiguration,
  database: drizzleAdapter(drizzle(pool), {
    provider: "pg",
    schema: authModels,
  }),
});
const deps: Deps = {
  newId: randomUUID,
  now: () => new Date(),
  secrets,
  documents,
};

/**
 * Un evento sale a los webhooks suscritos, después del commit, y a los
 * navegadores si cambia el tablero. No se guarda en ningún lado.
 */
const publish: Publish<Tx> = async (tx, event, { refreshesBoard }) => {
  const hooks = await subscribers(tx, event.type);
  if (hooks.length) tx.afterCommit(() => deliver(hooks, event));
  if (refreshesBoard) await tx.notify(event.type);
};

export const authenticator = createAuthenticator({
  unitOfWork: store,
  secrets,
  async sessionUserId(cookie) {
    const session = await auth.api.getSession({
      headers: new Headers({ cookie }),
    });
    return session?.user.id ?? null;
  },
});

export const catalog = createCatalog({
  modules: [
    ...authOrchestrators,
    boardsOrchestrator,
    cardsOrchestrator,
    fieldsOrchestrator,
    webhooksOrchestrator,
    assetsOrchestrator,
  ],
  unitOfWork: store,
  authenticator,
  publish,
  deps,
  newId: deps.newId,
  now: deps.now,
  events: sessionEvents,
});

export function recordSession(
  kind: "login" | "logout",
  actor: Actor,
  meta: { ip: string | null; userAgent: string | null },
) {
  return store.transaction((tx) =>
    publish(tx, sessionEvent(kind, actor, meta, deps), {
      refreshesBoard: false,
    }),
  );
}
