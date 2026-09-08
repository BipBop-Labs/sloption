import { Pool } from "pg";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { drizzle } from "drizzle-orm/node-postgres";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as schema from "../adapters/postgres/schema";
import { authConfiguration } from "./auth-options";
import { betterAuth } from "better-auth";
import { createStore } from "../adapters/postgres/store";
import { createService } from "../core/service";
import { createIdentityService } from "../core/identity";
import { documents } from "../adapters/documents/yjs";
import type { Actor } from "../core/actions";

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
export const secrets = {
  create: () => randomBytes(32).toString("base64url"),
  digest: (value: string) => createHash("sha256").update(value).digest("hex"),
};
export const authOptions = {
  ...authConfiguration,
  database: drizzleAdapter(drizzle(pool), { provider: "pg", schema }),
};
export const auth = betterAuth(authOptions);
export const service = createService({
  unitOfWork: store,
  newId: randomUUID,
  now: () => new Date(),
  secrets,
  documents,
});
export const identity = createIdentityService({
  store,
  secrets,
  newId: randomUUID,
  now: () => new Date(),
});
export async function resolveActor(headers: Headers): Promise<Actor | null> {
  const bearer = headers.get("authorization");
  if (bearer?.startsWith("Bearer ")) {
    const digest = secrets.digest(bearer.slice(7));
    return store.transaction(async (tx) => {
      const key = (await tx.list("keys")).find(
        (key) => key.digest === digest && !key.revoked,
      );
      if (!key) return null;
      const profile = await tx.get("profiles", key.ownerId);
      return profile
        ? {
            userId: profile.id,
            role: profile.role,
            agentId: key.agentId,
            apiKeyId: key.id,
          }
        : null;
    });
  }
  const session = await auth.api.getSession({ headers });
  if (!session) return null;
  return store.transaction(async (tx) => {
    const profile = (await tx.list("profiles")).find(
      (profile) => profile.authUserId === session.user.id,
    );
    return profile
      ? {
          userId: profile.id,
          role: profile.role,
          agentId: null,
          apiKeyId: null,
        }
      : null;
  });
}
