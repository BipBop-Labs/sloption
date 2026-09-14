import { describe, expect, test } from "vitest";
import { createAuthenticator } from "../src/backend/domains/auth/authenticator";
import type { Collection, Entities, Tx } from "../src/backend/domains/kernel";

/** Tienda en memoria: sin base ni servidor. */
function authenticator() {
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
  } as unknown as Tx;
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
  return createAuthenticator({
    unitOfWork: { transaction: (operation) => operation(tx) },
    // El token es su propio digest: alcanza para distinguir cuál se presentó.
    secrets: { digest: (value) => value },
    // La cookie es el id de BetterAuth: el adaptador real le pregunta a BetterAuth.
    sessionUserId: async (cookie) => cookie || null,
  });
}

const apiKey = (token: string) => ({ kind: "apiKey" as const, token });
const session = (cookie: string) => ({ kind: "session" as const, cookie });

describe("quién es el que llama", () => {
  test("una API key actúa como su dueño y anota al agente", async () => {
    expect(await authenticator().resolve(apiKey("digest-vigente"))).toEqual({
      userId: "ana",
      orgId: "main",
      role: "admin",
      agentId: "bot",
      apiKeyId: "k1",
    });
  });

  test("una key revocada no autentica", async () => {
    expect(await authenticator().resolve(apiKey("digest-revocado"))).toBeNull();
  });

  test("una key inexistente no autentica", async () => {
    expect(await authenticator().resolve(apiKey("cualquier-cosa"))).toBeNull();
  });

  test("la sesión resuelve al perfil, y el rol sale de ahí", async () => {
    expect(await authenticator().resolve(session("auth-ana"))).toEqual({
      userId: "ana",
      orgId: "main",
      role: "admin",
      agentId: null,
      apiKeyId: null,
    });
  });

  test("un usuario de auth sin perfil no autentica", async () => {
    expect(await authenticator().resolve(session("auth-fantasma"))).toBeNull();
  });

  test("sin credencial no hay actor", async () => {
    expect(await authenticator().resolve(null)).toBeNull();
    expect(await authenticator().resolve(session(""))).toBeNull();
  });
});
