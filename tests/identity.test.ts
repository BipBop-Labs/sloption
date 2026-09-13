import { describe, expect, test } from "vitest";
import { createIdentityService } from "../src/backend/core/identity";
import type { Collection, Entities } from "../src/backend/core/model";
import type { Transaction } from "../src/backend/core/ports";

/** Misma tienda en memoria que `archive.test.ts`: sin base ni servidor. */
function identity() {
  const store = new Map<string, unknown>();
  const tx = {
    async get(collection: string, id: string) {
      return (store.get(`${collection}/${id}`) ?? null) as never;
    },
    async list(collection: string) {
      return [...store.entries()]
        .filter(([key]) => key.startsWith(`${collection}/`))
        .map(([, value]) => value) as never;
    },
    async put(collection: string, entity: { id: string }) {
      store.set(`${collection}/${entity.id}`, entity);
    },
    async remove() {},
    async appendEvent() {},
    async createAccount() {
      return "";
    },
    async history() {
      return [];
    },
  } as unknown as Transaction;
  const put = <K extends Collection>(collection: K, entity: Entities[K]) =>
    store.set(`${collection}/${entity.id}`, entity);
  put("profiles", {
    id: "ana",
    name: "Ana",
    role: "admin",
    authUserId: "auth-ana",
    ownerId: null,
    kind: "person",
  });
  put("profiles", {
    id: "bot",
    name: "Bot de Ana",
    role: "member",
    authUserId: null,
    ownerId: "ana",
    kind: "agent",
  });
  put("keys", {
    id: "k1",
    ownerId: "ana",
    agentId: "bot",
    name: "Bot de Ana",
    digest: "digest-vigente",
    revoked: false,
  });
  put("keys", {
    id: "k2",
    ownerId: "ana",
    agentId: "bot",
    name: "Revocada",
    digest: "digest-revocado",
    revoked: true,
  });
  return createIdentityService({
    store: { transaction: (operation) => operation(tx) },
    // El token es su propio digest: alcanza para distinguir cuál se presentó.
    secrets: { create: () => "s", digest: (value) => value },
    newId: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-09-08T12:00:00Z"),
  });
}

describe("quién es el que llama", () => {
  test("una API key actúa como su dueño y anota al agente", async () => {
    const actor = await identity().fromApiKey("digest-vigente");
    expect(actor).toEqual({
      userId: "ana",
      role: "admin",
      agentId: "bot",
      apiKeyId: "k1",
    });
  });

  test("una key revocada no autentica", async () => {
    expect(await identity().fromApiKey("digest-revocado")).toBeNull();
  });

  test("una key inexistente no autentica", async () => {
    expect(await identity().fromApiKey("cualquier-cosa")).toBeNull();
  });

  test("la sesión resuelve al perfil, y el rol sale de ahí", async () => {
    const actor = await identity().fromSession("auth-ana");
    expect(actor).toEqual({
      userId: "ana",
      role: "admin",
      agentId: null,
      apiKeyId: null,
    });
  });

  test("un usuario de auth sin perfil no autentica", async () => {
    expect(await identity().fromSession("auth-fantasma")).toBeNull();
  });

  test("el perfil de un agente no se alcanza por sesión", async () => {
    expect(await identity().fromSession("")).toBeNull();
  });
});
