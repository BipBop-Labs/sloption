import { z } from "zod";
import { ActionError, raise } from "./errors";
import {
  defineEndpoint,
  defineEvent,
  defineRouter,
  eventSchema,
  implement,
  type AnyEndpoint,
  type AnyEvent,
  type Emitted,
  type Module,
  type RouterSpec,
} from "./endpoint";
import type { Authenticator, Credential, Publish, UnitOfWork } from "./ports";

/** Un endpoint resuelto: nombre de acción, ruta HTTP, comando CLI y evento. */
export interface Entry {
  name: string;
  cli: string;
  http: { method: "GET" | "POST"; path: string; response: "json" | "file" };
  event: string | null;
  spec: AnyEndpoint;
}

/** Un nombre, ruta o comando repetido rompe al arrancar, no en la primera llamada. */
export function listEndpoints(routers: readonly RouterSpec[]): Entry[] {
  const entries = routers.flatMap((router) =>
    Object.entries(router.endpoints).map(([key, spec]): Entry => ({
      name: `${router.name}.${key}`,
      cli: `${router.cli} ${key}`,
      http: {
        method: spec.http?.method ?? "POST",
        path: `${router.http}${spec.http?.path ?? `/${key}`}`,
        response: spec.http?.response ?? "json",
      },
      event: spec.event?.type ?? null,
      spec,
    })),
  );
  const seen = new Set<string>();
  for (const entry of entries)
    for (const key of [
      entry.name,
      `cli ${entry.cli}`,
      `http ${entry.http.method} ${entry.http.path}`,
    ]) {
      if (seen.has(key)) throw new Error(`Endpoint repetido: ${key}`);
      seen.add(key);
    }
  return entries;
}

/**
 * Cada evento una vez, aunque lo emitan varios endpoints. Dos definiciones
 * distintas con el mismo tipo rompen al arrancar: serían dos contratos con un
 * mismo nombre.
 */
export function listEvents(definitions: readonly (AnyEvent | null)[]) {
  const byType = new Map<string, AnyEvent>();
  for (const definition of definitions) {
    if (!definition) continue;
    const known = byType.get(definition.type);
    if (known && known !== definition)
      throw new Error(`Evento definido dos veces: ${definition.type}`);
    byType.set(definition.type, definition);
  }
  return [...byType.values()];
}

const listing = z
  .object({
    endpoints: z.array(
      z
        .object({
          name: z.string(),
          cli: z.string(),
          doc: z.string(),
          access: z.enum(["public", "member", "admin"]),
          http: z
            .object({ method: z.enum(["GET", "POST"]), path: z.string() })
            .strict(),
          input: z.json(),
          output: z.json(),
          event: z.string().nullable(),
          eventData: z.json(),
          errors: z.record(
            z.string(),
            z.object({ kind: z.string(), message: z.string() }).strict(),
          ),
        })
        .strict(),
    ),
    events: z.array(z.string()),
  })
  .strict();

const CatalogViewed = defineEvent("catalog.viewed.v1", {
  data: z.object({}).strict(),
  refreshesBoard: false,
});

const catalogRouter = defineRouter({
  name: "catalog",
  http: "/api/catalog",
  cli: "catalog",
  endpoints: {
    read: defineEndpoint({
      doc: "Todos los endpoints: JSON Schema de entrada y salida, acceso, errores y el evento que emiten, con su payload. Es de donde la CLI saca las rutas.",
      access: "member",
      input: z.object({}).strict(),
      output: listing,
      event: CatalogViewed,
    }),
  },
});

/**
 * El runner. Cada llamada, venga de HTTP o de la CLI, pasa por `execute`:
 * autentica, autoriza por rol, valida, abre la transacción, carga y autoriza el
 * recurso, llama al orquestador y publica el evento en la misma transacción.
 */
export function createCatalog<Tx>(options: {
  modules: readonly Module[];
  unitOfWork: UnitOfWork<Tx>;
  authenticator: Authenticator;
  publish: Publish<Tx>;
  deps: unknown;
  newId(): string;
  now(): Date;
  /** Eventos que no salen de un endpoint, como el login. También se suscriben. */
  events?: readonly AnyEvent[];
}) {
  const catalogModule = implement<typeof catalogRouter, Tx, unknown>(
    catalogRouter,
    {
      async read() {
        return { output: described, event: CatalogViewed({}) };
      },
    },
  );
  const modules = [...options.modules, catalogModule];
  const entries = listEndpoints(modules.map((module) => module.router));
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  const handlers = new Map<string, Module["handlers"][string]>(
    modules.flatMap((module) =>
      Object.entries(module.handlers).map(
        ([key, handler]) => [`${module.router.name}.${key}`, handler] as const,
      ),
    ),
  );
  const events = listEvents([
    ...entries.map((entry) => entry.spec.event),
    ...(options.events ?? []),
  ]).map((event) => event.type);
  const described = {
    endpoints: entries.map(({ name, cli, http, event, spec }) => ({
      name,
      cli,
      doc: spec.doc,
      access: spec.access,
      http: { method: http.method, path: http.path },
      input: z.toJSONSchema(spec.input),
      output: z.toJSONSchema(spec.output),
      event,
      eventData: spec.event ? z.toJSONSchema(spec.event.data) : null,
      errors: spec.errors ?? {},
    })),
    events,
  } as z.input<typeof listing>;

  async function execute(
    name: string,
    rawInput: unknown,
    credential: Credential | null,
  ): Promise<unknown> {
    const entry = byName.get(name);
    const handler = handlers.get(name);
    if (!entry || !handler)
      throw new ActionError("NOT_FOUND", "Unknown action", "UNKNOWN_ACTION");
    const { spec } = entry;
    const actor = await options.authenticator.resolve(credential);
    if (spec.access !== "public" && !actor)
      throw new ActionError("UNAUTHENTICATED", "Authentication required");
    if (spec.access === "admin" && actor?.role !== "admin")
      throw new ActionError("FORBIDDEN", "Administrator role required");
    const parsed = spec.input.safeParse(rawInput);
    if (!parsed.success)
      throw new ActionError("INVALID_INPUT", "Invalid action parameters");
    return options.unitOfWork.transaction(async (tx) => {
      let resource: unknown;
      if (spec.scope) {
        resource = await spec.scope.load(
          tx as never,
          spec.scope.from(parsed.data),
        );
        if (resource == null) throw new ActionError("NOT_FOUND", "Not found");
        if (spec.scope.allow && !(actor && spec.scope.allow(actor, resource)))
          throw new ActionError("FORBIDDEN", "Not allowed on this resource");
      }
      const run = handler as (
        input: unknown,
        context: unknown,
      ) => Promise<{ output: unknown; event?: unknown }>;
      const result = await run(parsed.data, {
        actor,
        tx,
        deps: options.deps,
        resource,
        catalog: { events },
        fail: (code: string, message?: string) =>
          raise(spec.errors ?? {}, code, message),
      });
      const output = spec.output.parse(result.output);
      if (spec.event) {
        const emitted = result.event as Emitted | undefined;
        // TypeScript ya lo exige; esto cubre un `as` o un `any` en el orquestador.
        if (emitted?.type !== spec.event.type)
          throw new Error(`${name} debe emitir ${spec.event.type}`);
        await options.publish(
          tx,
          eventSchema.parse({
            id: options.newId(),
            type: emitted.type,
            actor,
            occurredAt: options.now().toISOString(),
            data: emitted.data,
          }),
          { refreshesBoard: spec.event.refreshesBoard },
        );
      }
      return output;
    });
  }

  return { entries, events, execute };
}
