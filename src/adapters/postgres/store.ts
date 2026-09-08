import { and, desc, eq, lt, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import type { Pool } from "pg";
import type { ActionEvent, UnitOfWork } from "../../core/actions";
import type { Collection, Entities, Webhook } from "../../core/model";
import type { Transaction } from "../../core/ports";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { authConfiguration } from "../../server/auth-options";
import * as schema from "./schema";
import { records, events, deliveries } from "./schema";

export function createStore(pool: Pool): UnitOfWork<Transaction> {
  const db = drizzle(pool);
  return {
    transaction: (operation) =>
      db.transaction(async (dbtx) => {
        // A shared board has one write order, including events and collaborative updates.
        // Reads use the same short lock so SSE cursors cannot miss late-committing events.
        await dbtx.execute(sql`select pg_advisory_xact_lock(71924001)`);
        const transaction: Transaction = {
          async createAccount(email, password, name) {
            const accountService = betterAuth({
              ...authConfiguration,
              database: drizzleAdapter(dbtx, { provider: "pg", schema }),
            });
            const result = await accountService.api.signUpEmail({
              body: { email, password, name },
            });
            return result.user.id;
          },
          async get<K extends Collection>(collection: K, id: string) {
            const rows = await dbtx
              .select()
              .from(records)
              .where(
                and(eq(records.collection, collection), eq(records.id, id)),
              );
            return (rows[0]?.payload as Entities[K] | undefined) ?? null;
          },
          async list<K extends Collection>(collection: K) {
            const rows = await dbtx
              .select()
              .from(records)
              .where(eq(records.collection, collection));
            return rows.map((row) => row.payload as Entities[K]);
          },
          async put(collection, entity) {
            await dbtx
              .insert(records)
              .values({ collection, id: entity.id, payload: entity })
              .onConflictDoUpdate({
                target: [records.collection, records.id],
                set: { payload: entity },
              });
          },
          async remove(collection, id) {
            await dbtx
              .delete(records)
              .where(
                and(eq(records.collection, collection), eq(records.id, id)),
              );
          },
          async history(before, limit, includeReads) {
            const rows = await dbtx
              .select()
              .from(events)
              .where(
                and(
                  before ? lt(events.sequence, before) : undefined,
                  // Solo las acciones de lectura marcan `changed: false`. Los
                  // eventos de sesión no traen el campo y siempre se muestran.
                  includeReads
                    ? undefined
                    : sql`${events.payload}->'data'->>'changed' is distinct from 'false'`,
                ),
              )
              .orderBy(desc(events.sequence))
              .limit(limit);
            return rows.map((row) => ({
              ...row.payload,
              sequence: row.sequence,
            }));
          },
          async appendEvent(event: ActionEvent) {
            const [stored] = await dbtx
              .insert(events)
              .values({ payload: event })
              .returning();
            if (!stored) throw new Error("Event insert failed");
            const hooks = await transaction.list("webhooks");
            for (const hook of hooks)
              if (hook.enabled && hook.events.includes(event.type)) {
                await dbtx.insert(deliveries).values({
                  id: `${stored.sequence}:${hook.id}`,
                  eventSequence: stored.sequence,
                  webhookId: hook.id,
                });
              }
            await dbtx.execute(
              sql`select pg_notify('sloption_events', ${String(stored.sequence)})`,
            );
          },
        };
        return operation(transaction);
      }),
  };
}
