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
