import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createCatalog,
  listEndpoints,
  listEvents,
} from "../src/backend/lib/catalog";
import {
  defineEndpoint,
  defineEvent,
  defineRouter,
  implement,
  type ActionEvent,
  type Actor,
} from "../src/backend/lib/endpoint";
import { defineErrors } from "../src/backend/lib/errors";
import type { Field } from "../src/backend/domains/fields/schemas";
import { parseValue } from "../src/backend/domains/fields/services";

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

const ValueChanged = defineEvent("sample.valueChanged.v1", {
  data: z.object({ value: z.number() }).strict(),
  refreshesBoard: true,
});
const NoteViewed = defineEvent("sample.noteViewed.v1", {
  data: z.object({ noteId: z.string() }).strict(),
  refreshesBoard: false,
});

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
      event: ValueChanged,
      errors: defineErrors({ TOO_BIG: { kind: "CONFLICT", message: "Too big" } }),
    }),
    double: defineEndpoint({
      doc: "Guarda el doble: emite el mismo evento que set.",
      access: "member",
      input: z.object({ value: z.number() }).strict(),
      output: z.number(),
      event: ValueChanged,
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
      event: NoteViewed,
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
        return { output: input.value, event: ValueChanged(input) };
      },
      async double(input, { tx }) {
        tx.setValue(input.value * 2);
        return {
          output: input.value * 2,
          event: ValueChanged({ value: input.value * 2 }),
        };
      },
      async wipe() {
        return { output: "ok" };
      },
      async ping() {
        return { output: "pong" };
      },
      async note(_input, { resource }) {
        return {
          output: resource.id,
          event: NoteViewed({ noteId: resource.id }),
        };
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
      type: "sample.valueChanged.v1",
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
      event: "sample.valueChanged.v1",
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

describe("eventos", () => {
  it("un mismo evento sale de dos endpoints y el catálogo lo lista una vez", async () => {
    const f = fixture();
    await f.call("sample.set", { value: 1 });
    await f.call("sample.double", { value: 2 });
    expect(f.published.map((event) => [event.type, event.data])).toEqual([
      ["sample.valueChanged.v1", { value: 1 }],
      ["sample.valueChanged.v1", { value: 4 }],
    ]);
    expect(
      f.catalog.events.filter((type) => type === "sample.valueChanged.v1"),
    ).toHaveLength(1);
  });

  it("construirlo valida el payload", () => {
    expect(() => ValueChanged({ value: "7" as unknown as number })).toThrow();
  });

  it("dos definiciones con el mismo tipo rompen al arrancar", () => {
    const Impostor = defineEvent("sample.valueChanged.v1", {
      data: z.object({ other: z.string() }).strict(),
      refreshesBoard: false,
    });
    expect(() => listEvents([ValueChanged, Impostor])).toThrow(
      "Evento definido dos veces",
    );
    expect(listEvents([ValueChanged, null, ValueChanged])).toHaveLength(1);
  });

  it("el tipo tiene dominio, nombre y versión", () => {
    expect(() =>
      defineEvent("sin-version", {
        data: z.object({}).strict(),
        refreshesBoard: false,
      }),
    ).toThrow("Tipo de evento inválido");
  });
});

describe("valores de propiedades", () => {
  const field: Field = {
    id: "category",
    name: "Categoría",
    type: "multiSelect",
    options: [
      { id: "swe", label: "SWE" },
      { id: "product", label: "Producto" },
    ],
  };
  it("acepta vacío y rechaza selecciones que no existen", () => {
    expect(parseValue(field, null, new Set())).toBeNull();
    expect(parseValue(field, ["swe"], new Set())).toEqual(["swe"]);
    expect(() => parseValue(field, ["missing"], new Set())).toThrow();
    expect(() => parseValue(field, ["swe", "swe"], new Set())).toThrow();
  });
  it("valida fechas de calendario y números finitos", () => {
    expect(() =>
      parseValue({ ...field, type: "date" }, "2026-02-30", new Set()),
    ).toThrow();
    expect(() =>
      parseValue({ ...field, type: "number" }, Infinity, new Set()),
    ).toThrow();
  });
});
