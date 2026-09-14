import { and, eq, inArray } from "drizzle-orm";
import { raise } from "../../lib/errors";
import type { Deps, Tx } from "../kernel";
import { webhookErrors } from "./errors";
import { webhookEvents, webhooks } from "./models";
import type { NewWebhook, Webhook } from "./schemas";

type WebhookRow = typeof webhooks.$inferSelect;

async function withEvents(tx: Tx, rows: WebhookRow[]): Promise<Webhook[]> {
  if (!rows.length) return [];
  const events = await tx.sql
    .select()
    .from(webhookEvents)
    .where(
      inArray(
        webhookEvents.webhookId,
        rows.map((row) => row.id),
      ),
    );
  return rows.map((row) => ({
    ...row,
    events: events
      .filter((event) => event.webhookId === row.id)
      .map((event) => event.eventType),
  }));
}

export async function byId(tx: Tx, webhookId: string): Promise<Webhook | null> {
  const rows = await tx.sql.select().from(webhooks).where(eq(webhooks.id, webhookId));
  return (await withEvents(tx, rows))[0] ?? null;
}

export async function list(tx: Tx) {
  return (await withEvents(tx, await tx.sql.select().from(webhooks))).map(
    ({ secret: _secret, ...hook }) => hook,
  );
}

/** A quién le llega un evento: los webhooks activos suscritos a ese tipo. */
export const subscribers = (tx: Tx, eventType: string) =>
  tx.sql
    .select({ id: webhooks.id, url: webhooks.url, secret: webhooks.secret })
    .from(webhooks)
    .innerJoin(webhookEvents, eq(webhookEvents.webhookId, webhooks.id))
    .where(
      and(eq(webhookEvents.eventType, eventType), eq(webhooks.enabled, true)),
    );

function assertKnown(events: readonly string[], known: readonly string[]) {
  if (events.some((event) => !known.includes(event)))
    raise(webhookErrors, "UNKNOWN_EVENT");
}

async function writeEvents(tx: Tx, webhookId: string, events: string[]) {
  await tx.sql.delete(webhookEvents).where(eq(webhookEvents.webhookId, webhookId));
  const unique = [...new Set(events)];
  if (unique.length)
    await tx.sql
      .insert(webhookEvents)
      .values(unique.map((eventType) => ({ webhookId, eventType })));
}

export async function create(
  tx: Tx,
  deps: Deps,
  input: NewWebhook,
  known: readonly string[],
): Promise<Webhook> {
  assertKnown(input.events, known);
  const hook: Webhook = {
    id: deps.newId(),
    url: input.url,
    events: [...new Set(input.events)],
    enabled: input.enabled,
    secret: deps.secrets.create(),
  };
  await tx.sql.insert(webhooks).values({
    id: hook.id,
    url: hook.url,
    secret: hook.secret,
    enabled: hook.enabled,
  });
  await writeEvents(tx, hook.id, hook.events);
  return hook;
}

export async function update(
  tx: Tx,
  hook: Webhook,
  input: NewWebhook,
  known: readonly string[],
) {
  assertKnown(input.events, known);
  await tx.sql
    .update(webhooks)
    .set({ url: input.url, enabled: input.enabled })
    .where(eq(webhooks.id, hook.id));
  await writeEvents(tx, hook.id, input.events);
  return {
    id: hook.id,
    url: input.url,
    events: [...new Set(input.events)],
    enabled: input.enabled,
  };
}

export async function remove(tx: Tx, webhookId: string) {
  await tx.sql.delete(webhooks).where(eq(webhooks.id, webhookId));
}
