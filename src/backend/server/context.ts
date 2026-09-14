import { Pool } from "pg";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { betterAuth } from "better-auth";
import * as schema from "../adapters/postgres/schema";
import { createStore } from "../adapters/postgres/store";
import { documents } from "../adapters/documents/yjs";
import { authConfiguration } from "./auth-options";
import { createCatalog } from "../lib/catalog";
import type { Actor } from "../lib/endpoint";
import type { Publish } from "../lib/ports";
import type { Deps, Tx } from "../domains/kernel";
import { assetsOrchestrator } from "../domains/assets/orchestrator";
import { createAuthenticator } from "../domains/auth/authenticator";
import { sessionEventTypes } from "../domains/auth/events";
import { authOrchestrators } from "../domains/auth/orchestrator";
import { sessionEvent } from "../domains/auth/services";
import { boardsOrchestrator } from "../domains/boards/orchestrator";
import { cardsOrchestrator } from "../domains/cards/orchestrator";
import { fieldsOrchestrator } from "../domains/fields/orchestrator";
import { importsOrchestrator } from "../domains/imports/orchestrator";
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
  database: drizzleAdapter(drizzle(pool), { provider: "pg", schema }),
});
const deps: Deps = {
  newId: randomUUID,
  now: () => new Date(),
  secrets,
  documents,
};

/** Un evento sale a los webhooks suscritos y, si cambia el tablero, a los navegadores. */
const publish: Publish<Tx> = async (tx, event, { refreshesBoard }) => {
  for (const hook of subscribers(event, await tx.list("webhooks")))
    await tx.enqueueDelivery(hook.id, event);
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
    importsOrchestrator,
  ],
  unitOfWork: store,
  authenticator,
  publish,
  deps,
  newId: deps.newId,
  now: deps.now,
  events: sessionEventTypes,
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
