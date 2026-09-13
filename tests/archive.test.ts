import { describe, expect, test } from "vitest";
import { createService } from "../src/backend/core/service";
import type { Actor } from "../src/backend/core/actions";
import type { Card, Collection, Entities } from "../src/backend/core/model";
import type { Transaction } from "../src/backend/core/ports";

const actor: Actor = {
  userId: "u",
  role: "admin",
  agentId: null,
  apiKeyId: null,
};

/** Tienda en memoria: alcanza para probar acciones sin base ni servidor. */
function service() {
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
    async remove(collection: string, id: string) {
      store.delete(`${collection}/${id}`);
    },
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
  put("boards", { id: "main", name: "Tablero", groupingId: "status" });
  put("fields", {
    id: "status",
    name: "Estado",
    type: "select",
    options: [
      { id: "qa", label: "QA" },
      { id: "listo", label: "Listo" },
    ],
  });
  put("cards", {
    id: "c1",
    title: "Revisar la weekly",
    markdown: "",
    document: null,
    values: { status: "qa" },
    weekly: false,
    archived: false,
    archivedStage: null,
    rank: 1024,
    version: 1,
    createdAt: "",
    updatedAt: "",
    sourceId: null,
    bodyMissing: false,
  });
  const { execute } = createService({
    unitOfWork: { transaction: (operation) => operation(tx) },
    newId: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-09-08T12:00:00Z"),
    secrets: { create: () => "s", digest: () => "d" },
    documents: {
      initialize: () => "",
      merge: () => ({ document: "", markdown: "" }),
    },
  });
  const call = (name: string, input: unknown) =>
    execute(name, input, actor) as Promise<Card>;
  return { call, store };
}

describe("archivar una tarjeta", () => {
  test("guarda la etapa como etiqueta y suelta la columna", async () => {
    const { call } = service();
    const archived = await call("card.archive", { id: "c1", archived: true });
    expect(archived.archivedStage).toBe("QA");
    expect(archived.values.status).toBeNull();
  });

  test("borrar la columna no toca la etapa archivada", async () => {
    const { call } = service();
    await call("card.archive", { id: "c1", archived: true });
    await call("field.update", {
      id: "status",
      name: "Estado",
      options: [{ id: "listo", label: "Listo" }],
    });
    const card = await call("card.read", { id: "c1" });
    expect(card.archivedStage).toBe("QA");
    const restored = await call("card.archive", { id: "c1", archived: false });
    expect(restored.values.status).toBeNull();
    expect(restored.archivedStage).toBeNull();
  });

  test("restaurar devuelve la tarjeta a su etapa si sigue existiendo", async () => {
    const { call } = service();
    await call("card.archive", { id: "c1", archived: true });
    const restored = await call("card.archive", { id: "c1", archived: false });
    expect(restored.archived).toBe(false);
    expect(restored.values.status).toBe("qa");
    expect(restored.archivedStage).toBeNull();
  });
});
