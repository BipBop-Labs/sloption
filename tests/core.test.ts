import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createCatalog, listEndpoints } from "../src/backend/lib/catalog";
import {
  defineEndpoint,
  defineRouter,
  implement,
  type ActionEvent,
  type Actor,
} from "../src/backend/lib/endpoint";
import { defineErrors } from "../src/backend/lib/errors";
import {
  parsePropertyValue,
  removeOptionReference,
  type Property,
} from "../src/backend/domains/fields/properties";

const member: Actor = {
  userId: "owner",
  orgId: "main",
  role: "member",
  agentId: "agent",
  apiKeyId: "key",
};

interface Note {
  id: string;
  ownerId: string;
}
interface SampleTx {
  setValue(value: number): void;
  notes: Map<string, Note>;
  published: ActionEvent[];
}

const sampleRouter = defineRouter({
  name: "sample",
  http: "/api/sample",
  cli: "sample",
  endpoints: {
    set: defineEndpoint({
      doc: "Guarda un número.",
      access: "member",
      input: z.object({ value: z.number() }).strict(),
      output: z.number(),
      event: {
        data: z.object({ value: z.number() }).strict(),
        refreshesBoard: true,
      },
      errors: defineErrors({ TOO_BIG: { kind: "CONFLICT", message: "Too big" } }),
    }),
    wipe: defineEndpoint({
      doc: "Solo admins.",
      access: "admin",
      input: z.object({}).strict(),
      output: z.literal("ok"),
      event: null,
    }),
    ping: defineEndpoint({
      doc: "Sin sesión y sin evento.",
      http: { method: "GET", path: "/ping" },
      access: "public",
      input: z.object({}).strict(),
      output: z.literal("pong"),
      event: null,
    }),
    note: defineEndpoint({
      doc: "Lee una nota propia.",
      access: "member",
      input: z.object({ id: z.string() }).strict(),
      output: z.string(),
      scope: {
        load: async (tx: SampleTx, id: string) => tx.notes.get(id) ?? null,
        from: (input) => input.id,
        allow: (actor, note) => note.ownerId === actor.userId,
      },
      event: {
        data: z.object({ noteId: z.string() }).strict(),
        refreshesBoard: false,
      },
    }),
  },
});

function fixture({
  failPublish = false,
  actor = member as Actor | null,
} = {}) {
  let stored = 0;
  const published: ActionEvent[] = [];
  const notes = new Map<string, Note>([
    ["mine", { id: "mine", ownerId: "owner" }],
    ["theirs", { id: "theirs", ownerId: "someone" }],
  ]);
  const module = implement<typeof sampleRouter, SampleTx, unknown>(
    sampleRouter,
    {
      async set(input, { tx, fail }) {
        if (input.value > 100) fail("TOO_BIG");
        tx.setValue(input.value);
        return { output: input.value, event: { value: input.value } };
      },
      async wipe() {
        return { output: "ok" };
      },
      async ping() {
        return { output: "pong" };
      },
      async note(_input, { resource }) {
        return { output: resource.id, event: { noteId: resource.id } };
      },
    },
  );
  const catalog = createCatalog<SampleTx>({
    modules: [module],
    // Confirma el valor y los eventos solo si la operación termina.
    unitOfWork: {
      async transaction(operation) {
        let pending = stored;
        const events: ActionEvent[] = [];
        const result = await operation({
          setValue: (value) => {
            pending = value;
          },
          notes,
          published: events,
        });
        stored = pending;
        published.push(...events);
        return result;
      },
    },
    authenticator: { resolve: async () => actor },
    publish: async (tx, event) => {
      if (failPublish) throw new Error("Storage failure");
      tx.published.push(event);
    },
    deps: {},
    newId: () => "2d3fc8b4-9a11-4b77-a828-45fed3d69e71",
    now: () => new Date("2026-09-08T12:00:00Z"),
  });
  const call = (name: string, input: unknown) =>
    catalog.execute(name, input, { kind: "apiKey", token: "t" });
  return { call, catalog, published, value: () => stored };
}

describe("runner", () => {
  it("publica el evento con dueño y agente", async () => {
    const f = fixture();
    expect(await f.call("sample.set", { value: 7 })).toBe(7);
    expect(f.published).toHaveLength(1);
    expect(f.published[0]).toMatchObject({
      type: "sample.set.v1",
      actor: member,
      data: { value: 7 },
    });
    expect(f.value()).toBe(7);
  });

  it("no confirma el cambio si el evento no se pudo publicar", async () => {
    const f = fixture({ failPublish: true });
    await expect(f.call("sample.set", { value: 7 })).rejects.toThrow(
      "Storage failure",
    );
    expect(f.value()).toBe(0);
    expect(f.published).toEqual([]);
  });

  it("rechaza sin sesión y sin rol antes de ejecutar", async () => {
    await expect(
      fixture({ actor: null }).call("sample.set", { value: 7 }),
    ).rejects.toMatchObject({ kind: "UNAUTHENTICATED" });
    await expect(fixture().call("sample.wipe", {})).rejects.toMatchObject({
      kind: "FORBIDDEN",
    });
  });

  it("rechaza entradas mal formadas sin eventos ni cambios", async () => {
    const f = fixture();
    await expect(f.call("sample.set", { value: "7" })).rejects.toMatchObject({
      kind: "INVALID_INPUT",
    });
    expect(f.published).toEqual([]);
  });

  it("un error declarado lleva su código y su kind", async () => {
    const f = fixture();
    await expect(f.call("sample.set", { value: 101 })).rejects.toMatchObject({
      code: "TOO_BIG",
      kind: "CONFLICT",
    });
    expect(f.value()).toBe(0);
  });

  it("un endpoint público pasa sin sesión, y event null no publica", async () => {
    const f = fixture({ actor: null });
    expect(await f.call("sample.ping", {})).toBe("pong");
    expect(f.published).toEqual([]);
  });

  it("scope: carga, autoriza e inyecta el recurso", async () => {
    const f = fixture();
    expect(await f.call("sample.note", { id: "mine" })).toBe("mine");
    await expect(f.call("sample.note", { id: "missing" })).rejects.toMatchObject(
      { kind: "NOT_FOUND" },
    );
    await expect(f.call("sample.note", { id: "theirs" })).rejects.toMatchObject({
      kind: "FORBIDDEN",
    });
    expect(f.published.map((event) => event.data)).toEqual([
      { noteId: "mine" },
    ]);
  });

  it("deriva nombre, ruta, comando y evento", () => {
    const entries = fixture().catalog.entries;
    expect(entries.find((entry) => entry.name === "sample.set")).toMatchObject({
      cli: "sample set",
      http: { method: "POST", path: "/api/sample/set" },
      event: "sample.set.v1",
    });
    expect(entries.find((entry) => entry.name === "sample.ping")).toMatchObject({
      http: { method: "GET", path: "/api/sample/ping" },
      event: null,
    });
  });

  it("un endpoint repetido rompe al arrancar", () => {
    expect(() => listEndpoints([sampleRouter, sampleRouter])).toThrow(
      "Endpoint repetido",
    );
  });
});

describe("property values", () => {
  const property: Property = {
    id: "category",
    name: "Categoría",
    type: "multiSelect",
    options: [
      { id: "swe", label: "SWE" },
      { id: "product", label: "Producto" },
    ],
  };
  it("accepts empty values and rejects dangling selections", () => {
    expect(parsePropertyValue(property, null, new Set())).toBeNull();
    expect(parsePropertyValue(property, ["swe"], new Set())).toEqual(["swe"]);
    expect(() =>
      parsePropertyValue(property, ["missing"], new Set()),
    ).toThrow();
    expect(() =>
      parsePropertyValue(property, ["swe", "swe"], new Set()),
    ).toThrow();
  });
  it("clears only the removed option", () => {
    expect(removeOptionReference(["swe", "product"], "swe")).toEqual([
      "product",
    ]);
    expect(removeOptionReference("swe", "swe")).toBeNull();
  });
  it("validates calendar dates and finite numbers", () => {
    expect(() =>
      parsePropertyValue(
        { ...property, type: "date" },
        "2026-02-30",
        new Set(),
      ),
    ).toThrow();
    expect(() =>
      parsePropertyValue({ ...property, type: "number" }, Infinity, new Set()),
    ).toThrow();
  });
});
