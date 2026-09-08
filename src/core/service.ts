import { z } from "zod";
import {
  ActionError,
  createActionRunner,
  eventSchema,
  type Actor,
  type UnitOfWork,
} from "./actions";
import type { Card, Collection, Entities } from "./model";
import type { Documents, Secrets, Transaction } from "./ports";
import { parsePropertyValue, propertySchema } from "./properties";

const id = z.string().min(1).max(200);
const empty = z.object({}).strict();
const byId = z.object({ id }).strict();
const value = z.union([
  z.string(),
  z.number().finite(),
  z.array(z.string()),
  z.null(),
]);
const values = z.record(z.string(), value);
const role = z.enum(["admin", "member"]);
const option = z
  .object({ id, label: z.string().trim().min(1).max(100) })
  .strict();
const fieldInput = z
  .object({
    name: z.string().trim().min(1).max(100),
    type: z.enum(["text", "number", "date", "select", "multiSelect"]),
    options: z.array(option).default([]),
  })
  .strict();
const cardSchema = z
  .object({
    id,
    title: z.string(),
    markdown: z.string(),
    document: z.string().nullable(),
    values,
    weekly: z.boolean(),
    archived: z.boolean(),
    rank: z.number(),
    version: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
    sourceId: z.string().nullable(),
    bodyMissing: z.boolean(),
  })
  .strict();
const profileSchema = z
  .object({
    theme: z.enum(["light", "dark"]).optional(),
    id,
    name: z.string(),
    role,
    authUserId: z.string().nullable(),
    ownerId: z.string().nullable(),
    kind: z.enum(["person", "agent"]),
  })
  .strict();
const eventData = z
  .object({ entityId: z.string().nullable(), changed: z.boolean() })
  .strict();
const json = z.json();
const boardSchema = z.object({ id, name: z.string(), groupingId: id }).strict();
const boardOutput = z
  .object({
    board: boardSchema.nullable(),
    fields: z.array(propertySchema),
    profiles: z.array(profileSchema),
    cards: z.array(cardSchema.omit({ document: true, markdown: true })),
  })
  .strict();
const keySchema = z
  .object({
    id,
    ownerId: id,
    agentId: id,
    name: z.string(),
    revoked: z.boolean(),
  })
  .strict();
const hookSchema = z
  .object({ id, url: z.url(), events: z.array(id), enabled: z.boolean() })
  .strict();
const assetSchema = z
  .object({ id, mime: z.string(), content: z.string(), name: z.string() })
  .strict();
const ok = z.object({ ok: z.literal(true) }).strict();

type Handler<I> = (input: I, actor: Actor, tx: Transaction) => Promise<unknown>;

export function createService(deps: {
  unitOfWork: UnitOfWork<Transaction>;
  newId(): string;
  now(): Date;
  secrets: Secrets;
  documents: Documents;
}) {
  const run = createActionRunner(deps);
  const registry = new Map<
    string,
    (input: unknown, actor: Actor | null) => Promise<unknown>
  >();
  const catalog: {
    name: string;
    access: string;
    input: unknown;
    output: unknown;
    event: string;
  }[] = [];

  function register<I>(
    name: string,
    input: z.ZodType<I>,
    output: z.ZodType,
    access: "member" | "admin",
    changed: boolean,
    handler: Handler<I>,
  ) {
    registry.set(name, (raw, actor) =>
      run(
        {
          name,
          input,
          output,
          access,
          event: { type: `${name}.v1`, data: eventData },
          async execute(parsed, identity, tx) {
            const result = await handler(parsed, identity, tx);
            const record =
              result && typeof result === "object" && !Array.isArray(result)
                ? result
                : {};
            return {
              output: result,
              eventData: {
                entityId:
                  "id" in record && typeof record.id === "string"
                    ? record.id
                    : null,
                changed,
              },
            };
          },
        },
        raw,
        actor,
      ),
    );
    catalog.push({
      name,
      access,
      input: z.toJSONSchema(input),
      output: z.toJSONSchema(output),
      event: `${name}.v1`,
    });
  }

  async function requireEntity<K extends Collection>(
    tx: Transaction,
    collection: K,
    entityId: string,
  ): Promise<Entities[K]> {
    const entity = await tx.get(collection, entityId);
    if (!entity)
      throw new ActionError("NOT_FOUND", `${collection} entry not found`);
    return entity;
  }
  async function validateValues(tx: Transaction, proposed: Card["values"]) {
    const fields = await tx.list("fields");
    const profiles = await tx.list("profiles");
    const fieldMap = new Map(fields.map((field) => [field.id, field]));
    const profileIds = new Set(profiles.map((profile) => profile.id));
    for (const [fieldId, fieldValue] of Object.entries(proposed)) {
      const field = fieldMap.get(fieldId);
      if (!field) throw new ActionError("INVALID_INPUT", "Unknown property");
      try {
        parsePropertyValue(field, fieldValue, profileIds);
      } catch {
        throw new ActionError(
          "INVALID_INPUT",
          `Invalid value for ${field.name}`,
        );
      }
    }
  }
  async function saveCard(tx: Transaction, card: Card) {
    card.version += 1;
    card.updatedAt = deps.now().toISOString();
    await tx.put("cards", card);
    return card;
  }
  register(
    "catalog.read",
    empty,
    z.array(
      z
        .object({
          name: id,
          access: z.enum(["admin", "member"]),
          input: json,
          output: json,
          event: id,
        })
        .strict(),
    ),
    "member",
    false,
    async () => catalog as z.infer<typeof json>,
  );
  register(
    "board.read",
    z
      .object({ view: z.enum(["week", "all", "archived"]).default("week") })
      .strict(),
    boardOutput,
    "member",
    false,
    async (input, _actor, tx) => {
      const boards = await tx.list("boards");
      const fields = await tx.list("fields");
      const profiles = await tx.list("profiles");
      const cards = await tx.list("cards");
      const primary = ["priority", "assignees", "status"];
      fields.sort(
        (a, b) =>
          (primary.includes(a.id) ? primary.indexOf(a.id) : 3) -
          (primary.includes(b.id) ? primary.indexOf(b.id) : 3),
      );
      return {
        board: boards[0] ?? null,
        fields,
        profiles,
        cards: cards
          .filter((card) =>
            input.view === "archived"
              ? card.archived
              : !card.archived && (input.view === "all" || card.weekly),
          )
          .sort((a, b) => a.rank - b.rank)
          .map(({ document: _document, markdown: _markdown, ...card }) => card),
      };
    },
  );
  register(
    "board.configure",
    z.object({ groupingId: id }).strict(),
    boardSchema,
    "admin",
    true,
    async (input, _actor, tx) => {
      const field = await requireEntity(tx, "fields", input.groupingId);
      if (field.type !== "select")
        throw new ActionError(
          "INVALID_INPUT",
          "Group by a single selection property",
        );
      const board = await requireEntity(tx, "boards", "main");
      board.groupingId = field.id;
      await tx.put("boards", board);
      return board;
    },
  );
  register(
    "card.read",
    byId,
    cardSchema,
    "member",
    false,
    async (input, _actor, tx) => {
      const card = await requireEntity(tx, "cards", input.id);
      if (!card.document) {
        card.document = deps.documents.initialize(card.markdown);
        await tx.put("cards", card);
      }
      return card;
    },
  );
  register(
    "card.create",
    z
      .object({
        title: z.string().trim().min(1).max(500),
        values: values.default({}),
        weekly: z.boolean().default(false),
      })
      .strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      await validateValues(tx, input.values);
      const now = deps.now().toISOString();
      const cards = await tx.list("cards");
      const card: Card = {
        id: deps.newId(),
        ...input,
        markdown: "",
        document: null,
        archived: false,
        rank: Math.max(0, ...cards.map((card) => card.rank)) + 1024,
        version: 1,
        createdAt: now,
        updatedAt: now,
        sourceId: null,
        bodyMissing: false,
      };
      await tx.put("cards", card);
      return card;
    },
  );
  register(
    "card.update",
    z
      .object({
        id,
        version: z.number().int().positive(),
        title: z.string().trim().min(1).max(500).optional(),
        values: values.optional(),
      })
      .strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      const card = await requireEntity(tx, "cards", input.id);
      if (card.version !== input.version)
        throw new ActionError("CONFLICT", "Card changed; reload before saving");
      if (input.title !== undefined) card.title = input.title;
      if (input.values) {
        await validateValues(tx, input.values);
        card.values = { ...card.values, ...input.values };
      }
      return saveCard(tx, card);
    },
  );
  register(
    "card.week",
    z.object({ id, weekly: z.boolean() }).strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      const card = await requireEntity(tx, "cards", input.id);
      card.weekly = input.weekly;
      return saveCard(tx, card);
    },
  );
  register(
    "card.archive",
    z.object({ id, archived: z.boolean() }).strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      const card = await requireEntity(tx, "cards", input.id);
      card.archived = input.archived;
      return saveCard(tx, card);
    },
  );
  register(
    "card.move",
    z
      .object({
        id,
        optionId: id.nullable(),
        beforeId: id.nullable().default(null),
      })
      .strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      const board = await requireEntity(tx, "boards", "main");
      await validateValues(tx, { [board.groupingId]: input.optionId });
      const card = await requireEntity(tx, "cards", input.id);
      const siblings = (await tx.list("cards"))
        .filter(
          (item) =>
            item.id !== card.id &&
            item.archived === card.archived &&
            (item.values[board.groupingId] ?? null) === input.optionId,
        )
        .sort((a, b) => a.rank - b.rank);
      let position =
        input.beforeId === null
          ? siblings.length
          : siblings.findIndex((item) => item.id === input.beforeId);
      if (position < 0) throw new ActionError("CONFLICT", "Target card moved");
      card.values[board.groupingId] = input.optionId;
      siblings.splice(position, 0, card);
      for (const [index, sibling] of siblings.entries()) {
        const rank = (index + 1) * 1024;
        if (sibling.id === card.id) {
          card.rank = rank;
        } else if (sibling.rank !== rank) {
          sibling.rank = rank;
          await tx.put("cards", sibling);
        }
      }
      return saveCard(tx, card);
    },
  );
  register(
    "document.apply",
    z.object({ id, update: z.string().min(1).max(3_000_000) }).strict(),
    cardSchema,
    "member",
    true,
    async (input, _actor, tx) => {
      const card = await requireEntity(tx, "cards", input.id);
      try {
        Object.assign(
          card,
          deps.documents.merge(card.document, card.markdown, input.update),
        );
      } catch {
        throw new ActionError("INVALID_INPUT", "Invalid document update");
      }
      card.bodyMissing = false;
      return saveCard(tx, card);
    },
  );
  register(
    "field.create",
    fieldInput,
    propertySchema,
    "admin",
    true,
    async (input, _actor, tx) => {
      if (
        new Set(input.options.map((item) => item.id)).size !==
        input.options.length
      )
        throw new ActionError("INVALID_INPUT", "Duplicate option");
      const field = { id: deps.newId(), ...input };
      await tx.put("fields", field);
      return field;
    },
  );
  register(
    "field.update",
    z
      .object({
        id,
        name: z.string().trim().min(1).max(100),
        options: z.array(option),
      })
      .strict(),
    propertySchema,
    "admin",
    true,
    async (input, _actor, tx) => {
      const field = await requireEntity(tx, "fields", input.id);
      if (
        new Set(input.options.map((item) => item.id)).size !==
        input.options.length
      )
        throw new ActionError("INVALID_INPUT", "Duplicate option");
      if (
        field.type !== "select" &&
        field.type !== "multiSelect" &&
        input.options.length
      )
        throw new ActionError("INVALID_INPUT", "This property has no options");
      Object.assign(field, input);
      await tx.put("fields", field);
      if (field.type === "select" || field.type === "multiSelect") {
        const valid = new Set(field.options.map((item) => item.id));
        for (const card of await tx.list("cards")) {
          const current = card.values[field.id];
          if (current == null) continue;
          const next = Array.isArray(current)
            ? current.filter((item) => valid.has(item))
            : valid.has(String(current))
              ? current
              : null;
          if (JSON.stringify(next) !== JSON.stringify(current)) {
            card.values[field.id] = next;
            await saveCard(tx, card);
          }
        }
      }
      return field;
    },
  );
  register(
    "field.remove",
    byId,
    ok,
    "admin",
    true,
    async (input, _actor, tx) => {
      const board = await requireEntity(tx, "boards", "main");
      if (board.groupingId === input.id)
        throw new ActionError(
          "CONFLICT",
          "Choose another grouping before removing this property",
        );
      await tx.remove("fields", input.id);
      for (const card of await tx.list("cards"))
        if (input.id in card.values) {
          delete card.values[input.id];
          await saveCard(tx, card);
        }
      return { ok: true };
    },
  );
  register(
    "profile.preferences",
    z.object({ theme: z.enum(["light", "dark"]) }).strict(),
    profileSchema,
    "member",
    true,
    async (input, actor, tx) => {
      const profile = await requireEntity(tx, "profiles", actor.userId);
      profile.theme = input.theme;
      await tx.put("profiles", profile);
      return profile;
    },
  );
  register(
    "profile.list",
    empty,
    z.array(profileSchema),
    "member",
    false,
    async (_input, _actor, tx) => tx.list("profiles"),
  );
  register(
    "profile.update",
    z.object({ id, role }).strict(),
    profileSchema,
    "admin",
    true,
    async (input, _actor, tx) => {
      const profile = await requireEntity(tx, "profiles", input.id);
      if (
        profile.role === "admin" &&
        input.role === "member" &&
        (await tx.list("profiles")).filter(
          (item) => item.role === "admin" && item.authUserId,
        ).length <= 1
      )
        throw new ActionError(
          "CONFLICT",
          "Keep at least one active administrator",
        );
      profile.role = input.role;
      await tx.put("profiles", profile);
      return profile;
    },
  );
  register(
    "invitation.create",
    z
      .object({
        email: z.email(),
        role,
        profileId: id.nullable().default(null),
      })
      .strict(),
    z.object({ id, token: z.string() }).strict(),
    "admin",
    false,
    async (input, _actor, tx) => {
      if (input.profileId) {
        const profile = await requireEntity(tx, "profiles", input.profileId);
        if (profile.authUserId)
          throw new ActionError("CONFLICT", "Identity already linked");
      }
      const token = deps.secrets.create();
      const invitation = {
        id: deps.newId(),
        ...input,
        email: input.email.toLowerCase(),
        digest: deps.secrets.digest(token),
        used: false,
      };
      await tx.put("invitations", invitation);
      return { id: invitation.id, token };
    },
  );
  register(
    "key.list",
    empty,
    z.array(keySchema),
    "member",
    false,
    async (_input, actor, tx) =>
      (await tx.list("keys"))
        .filter((key) => key.ownerId === actor.userId)
        .map(({ digest: _digest, ...key }) => key),
  );
  register(
    "key.create",
    z.object({ name: z.string().trim().min(1).max(100) }).strict(),
    z.object({ id, agentId: id, token: z.string() }).strict(),
    "member",
    true,
    async (input, actor, tx) => {
      const token = `slop_${deps.secrets.create()}`;
      const agentId = deps.newId();
      await tx.put("profiles", {
        id: agentId,
        name: input.name,
        role: "member",
        authUserId: null,
        ownerId: actor.userId,
        kind: "agent",
      });
      const key = {
        id: deps.newId(),
        ownerId: actor.userId,
        agentId,
        name: input.name,
        digest: deps.secrets.digest(token),
        revoked: false,
      };
      await tx.put("keys", key);
      return { id: key.id, agentId, token };
    },
  );
  register(
    "key.revoke",
    byId,
    ok,
    "member",
    false,
    async (input, actor, tx) => {
      const key = await requireEntity(tx, "keys", input.id);
      if (key.ownerId !== actor.userId)
        throw new ActionError(
          "FORBIDDEN",
          "Only the owner can revoke this key",
        );
      key.revoked = true;
      await tx.put("keys", key);
      return { ok: true };
    },
  );
  register(
    "history.list",
    z
      .object({
        before: z.number().int().positive().optional(),
        limit: z.number().int().min(1).max(100).default(50),
      })
      .strict(),
    z.array(eventSchema.extend({ sequence: z.number().int() })),
    "member",
    false,
    async (input, _actor, tx) => tx.history(input.before, input.limit),
  );
  register(
    "webhook.list",
    empty,
    z.array(hookSchema),
    "admin",
    false,
    async (_input, _actor, tx) =>
      (await tx.list("webhooks")).map(({ secret: _secret, ...hook }) => hook),
  );
  const webhookInput = z
    .object({
      url: z.url().refine((url) => /^https?:\/\//.test(url)),
      events: z.array(id).min(1),
      enabled: z.boolean(),
    })
    .strict();
  register(
    "webhook.create",
    webhookInput,
    hookSchema.extend({ secret: z.string() }),
    "admin",
    false,
    async (input, _actor, tx) => {
      if (
        input.events.some(
          (event) => !catalog.some((action) => action.event === event),
        )
      )
        throw new ActionError("INVALID_INPUT", "Unknown event");
      const hook = {
        id: deps.newId(),
        ...input,
        secret: deps.secrets.create(),
      };
      await tx.put("webhooks", hook);
      return hook;
    },
  );
  register(
    "webhook.update",
    webhookInput.extend({ id }),
    hookSchema,
    "admin",
    false,
    async (input, _actor, tx) => {
      if (
        input.events.some(
          (event) => !catalog.some((action) => action.event === event),
        )
      )
        throw new ActionError("INVALID_INPUT", "Unknown event");
      const hook = await requireEntity(tx, "webhooks", input.id);
      Object.assign(hook, input);
      await tx.put("webhooks", hook);
      const { secret: _secret, ...result } = hook;
      return result;
    },
  );
  register(
    "webhook.remove",
    byId,
    ok,
    "admin",
    false,
    async (input, _actor, tx) => {
      await tx.remove("webhooks", input.id);
      return { ok: true };
    },
  );
  register(
    "asset.create",
    z
      .object({
        mime: z.enum(["image/png", "image/jpeg", "image/gif", "image/webp"]),
        name: z.string().max(300),
        content: z.string().max(7_000_000),
      })
      .strict(),
    z.object({ id, url: z.string() }).strict(),
    "member",
    false,
    async (input, _actor, tx) => {
      const asset = { id: deps.newId(), ...input };
      await tx.put("assets", asset);
      return { id: asset.id, url: `/api/assets/${asset.id}` };
    },
  );
  register(
    "asset.read",
    byId,
    assetSchema,
    "member",
    false,
    async (input, _actor, tx) => requireEntity(tx, "assets", input.id),
  );
  register(
    "import.apply",
    z
      .object({
        cards: z.array(cardSchema).max(5000),
        profiles: z.array(profileSchema),
        fields: z.array(propertySchema),
      })
      .strict(),
    z.object({ inserted: z.number().int(), total: z.number().int() }).strict(),
    "admin",
    true,
    async (input, _actor, tx) => {
      for (const profile of input.profiles)
        if (!(await tx.get("profiles", profile.id)))
          await tx.put("profiles", {
            ...profile,
            role: "member",
            authUserId: null,
            ownerId: null,
            kind: "person",
          });
      for (const field of input.fields)
        if (!(await tx.get("fields", field.id))) await tx.put("fields", field);
      let inserted = 0;
      for (const card of input.cards)
        if (!(await tx.get("cards", card.id))) {
          await validateValues(tx, card.values);
          await tx.put("cards", card);
          inserted++;
        }
      return { inserted, total: input.cards.length };
    },
  );
  return {
    catalog,
    async execute(name: string, input: unknown, actor: Actor | null) {
      const action = registry.get(name);
      if (!action) throw new ActionError("NOT_FOUND", "Unknown action");
      return action(input, actor);
    },
  };
}
