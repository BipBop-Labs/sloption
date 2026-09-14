import { describe, expect, test } from "vitest";
import { createCatalog } from "../src/backend/lib/catalog";
import type { Actor } from "../src/backend/lib/endpoint";
import { boardsOrchestrator } from "../src/backend/domains/boards/orchestrator";
import { cardsOrchestrator } from "../src/backend/domains/cards/orchestrator";
import { fieldsOrchestrator } from "../src/backend/domains/fields/orchestrator";
import type {
  Card,
  Collection,
  Entities,
  Tx,
} from "../src/backend/domains/kernel";

const actor: Actor = {
  userId: "u",
  orgId: "main",
  role: "admin",
  agentId: null,
  apiKeyId: null,
};

/** Tienda en memoria: alcanza para probar endpoints sin base ni servidor. */
function catalog() {
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
  } as unknown as Tx;
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
  const { execute } = createCatalog<Tx>({
    modules: [boardsOrchestrator, cardsOrchestrator, fieldsOrchestrator],
    unitOfWork: { transaction: (operation) => operation(tx) },
    authenticator: { resolve: async () => actor },
    publish: async () => {},
    deps: {
      newId: () => "11111111-1111-4111-8111-111111111111",
      now: () => new Date("2026-09-08T12:00:00Z"),
      secrets: { create: () => "s", digest: () => "d" },
      documents: {
        initialize: () => "",
        merge: () => ({ document: "", markdown: "" }),
      },
    },
    newId: () => "11111111-1111-4111-8111-111111111111",
    now: () => new Date("2026-09-08T12:00:00Z"),
  });
  const call = (name: string, input: unknown) =>
    execute(name, input, null) as Promise<Card>;
  return { call };
}

describe("archivar una tarjeta", () => {
  test("guarda la etapa como etiqueta y suelta la columna", async () => {
    const { call } = catalog();
    const archived = await call("cards.archive", { id: "c1", archived: true });
    expect(archived.archivedStage).toBe("QA");
    expect(archived.values.status).toBeNull();
  });

  test("borrar la columna no toca la etapa archivada", async () => {
    const { call } = catalog();
    await call("cards.archive", { id: "c1", archived: true });
    await call("fields.update", {
      id: "status",
      name: "Estado",
      options: [{ id: "listo", label: "Listo" }],
    });
    const card = await call("cards.read", { id: "c1" });
    expect(card.archivedStage).toBe("QA");
    const restored = await call("cards.archive", { id: "c1", archived: false });
    expect(restored.values.status).toBeNull();
    expect(restored.archivedStage).toBeNull();
  });

  test("restaurar devuelve la tarjeta a su etapa si sigue existiendo", async () => {
    const { call } = catalog();
    await call("cards.archive", { id: "c1", archived: true });
    const restored = await call("cards.archive", { id: "c1", archived: false });
    expect(restored.archived).toBe(false);
    expect(restored.values.status).toBe("qa");
    expect(restored.archivedStage).toBeNull();
  });
});
