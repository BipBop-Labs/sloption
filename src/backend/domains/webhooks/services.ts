import type { ActionEvent } from "../../lib/endpoint";
import { raise } from "../../lib/errors";
import type { Deps, Tx } from "../kernel";
import { webhookErrors } from "./errors";
import type { Webhook } from "./model";

/** A quién le llega un evento. La suscripción decide, no la emisión. */
export function subscribers(event: ActionEvent, hooks: readonly Webhook[]) {
  return hooks.filter(
    (hook) => hook.enabled && hook.events.includes(event.type),
  );
}

export const byId = (tx: Tx, webhookId: string) => tx.get("webhooks", webhookId);

export async function list(tx: Tx) {
  return (await tx.list("webhooks")).map(
    ({ secret: _secret, ...hook }) => hook,
  );
}

interface Subscription {
  url: string;
  events: string[];
  enabled: boolean;
}

function assertKnown(events: readonly string[], known: readonly string[]) {
  if (events.some((event) => !known.includes(event)))
    raise(webhookErrors, "UNKNOWN_EVENT");
}

export async function create(
  tx: Tx,
  deps: Deps,
  input: Subscription,
  known: readonly string[],
) {
  assertKnown(input.events, known);
  const hook: Webhook = {
    id: deps.newId(),
    ...input,
    secret: deps.secrets.create(),
  };
  await tx.put("webhooks", hook);
  return hook;
}

export async function update(
  tx: Tx,
  hook: Webhook,
  input: Subscription,
  known: readonly string[],
) {
  assertKnown(input.events, known);
  Object.assign(hook, {
    url: input.url,
    events: input.events,
    enabled: input.enabled,
  });
  await tx.put("webhooks", hook);
  const { secret: _secret, ...result } = hook;
  return result;
}

export const remove = (tx: Tx, webhookId: string) =>
  tx.remove("webhooks", webhookId);
