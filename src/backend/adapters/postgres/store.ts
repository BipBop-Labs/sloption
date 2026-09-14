import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import * as authModels from "../../domains/auth/models";
import type { Tx } from "../../domains/kernel";
import type { UnitOfWork } from "../../lib/ports";
import { authConfiguration } from "../../server/auth-options";

export function createStore(pool: Pool): UnitOfWork<Tx> {
  const db = drizzle(pool);
  return {
    async transaction(operation) {
      const committed: (() => void)[] = [];
      const result = await db.transaction(async (sqlTx) => {
        // A shared board has one write order, including collaborative updates.
        await sqlTx.execute(sql`select pg_advisory_xact_lock(71924001)`);
        return operation({
          sql: sqlTx,
          afterCommit(task) {
            committed.push(task);
          },
          async createAccount(email, password, name) {
            const accountService = betterAuth({
              ...authConfiguration,
              database: drizzleAdapter(sqlTx, {
                provider: "pg",
                schema: authModels,
              }),
            });
            const account = await accountService.api.signUpEmail({
              body: { email, password, name },
            });
            return account.user.id;
          },
          async notify(type) {
            await sqlTx.execute(sql`select pg_notify('sloption_events', ${type})`);
          },
        });
      });
      for (const task of committed) task();
      return result;
    },
  };
}
