import { implement } from "../kernel";
import { webhooksRouter } from "./router";
import * as webhooks from "./services";

export const webhooksOrchestrator = implement(webhooksRouter, {
  async list(_input, { tx }) {
    return { output: await webhooks.list(tx), event: { entityId: null } };
  },
  async create(input, { tx, deps, catalog }) {
    const hook = await webhooks.create(tx, deps, input, catalog.events);
    return {
      output: hook,
      event: { webhookId: hook.id, url: hook.url, events: hook.events },
    };
  },
  async update(input, { tx, resource, catalog }) {
    const hook = await webhooks.update(tx, resource, input, catalog.events);
    return {
      output: hook,
      event: {
        webhookId: hook.id,
        url: hook.url,
        events: hook.events,
        enabled: hook.enabled,
      },
    };
  },
  async remove(input, { tx }) {
    await webhooks.remove(tx, input.id);
    return { output: { ok: true } as const, event: { webhookId: input.id } };
  },
});
