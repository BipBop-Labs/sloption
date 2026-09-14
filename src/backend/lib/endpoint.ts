import { z } from "zod";
import type { ErrorSpecs } from "./errors";

const eventTypePattern = /^[a-z][a-zA-Z]*\.[a-zA-Z]+\.v[1-9][0-9]*$/;

export const actorSchema = z
  .object({
    userId: z.string().min(1),
    /** Hoy siempre "main": una organización por deploy. Ver Roadmap en ESTADO.md. */
    orgId: z.string().min(1),
    role: z.enum(["admin", "member"]),
    agentId: z.string().min(1).nullable(),
    apiKeyId: z.string().min(1).nullable(),
  })
  .strict();
export type Actor = z.infer<typeof actorSchema>;

export const eventSchema = z
  .object({
    id: z.string().uuid(),
    type: z.string().regex(eventTypePattern),
    /** Null en endpoints públicos: quien acepta una invitación todavía no tiene sesión. */
    actor: actorSchema.nullable(),
    occurredAt: z.iso.datetime(),
    data: z.record(z.string(), z.json()),
  })
  .strict();
export type ActionEvent = z.infer<typeof eventSchema>;

export type Access = "public" | "member" | "admin";

/** Un evento listo para publicar: su tipo y su payload, ya validado. */
export interface Emitted<Type extends string = string, Data = unknown> {
  type: Type;
  data: Data;
}

export interface EventDefinition<Type extends string, Data extends z.ZodType> {
  (data: z.input<Data>): Emitted<Type, z.output<Data>>;
  readonly type: Type;
  readonly data: Data;
  /** Si los navegadores abiertos tienen que recargar el tablero. */
  readonly refreshesBoard: boolean;
}
// oxlint-disable-next-line no-explicit-any -- cada evento tiene su payload
export type AnyEvent = EventDefinition<string, any>;

/**
 * Un evento tiene nombre propio y versión, y no depende de qué endpoint lo emite:
 * `cards.created.v1` puede salir de `cards create` y de un `cards batchCreate`. El
 * nombre es el contrato de los webhooks, así que renombrar un endpoint no los rompe.
 * Llamarlo valida el payload: el error apunta a la línea que lo construyó.
 */
export function defineEvent<const Type extends string, Data extends z.ZodType>(
  type: Type,
  options: { data: Data; refreshesBoard: boolean },
): EventDefinition<Type, Data> {
  if (!eventTypePattern.test(type))
    throw new Error(`Tipo de evento inválido: ${type}. Formato: dominio.evento.v1`);
  const emit = (data: z.input<Data>): Emitted<Type, z.output<Data>> => ({
    type,
    data: options.data.parse(data) as z.output<Data>,
  });
  return Object.assign(emit, { type, ...options });
}

/** Permiso que depende del recurso. El runner lo carga, lo autoriza y se lo pasa al orquestador. */
export interface Scope<Input, Resource> {
  /** Corre dentro de la transacción del endpoint. `null` responde NOT_FOUND. */
  load(transaction: never, id: string): Promise<Resource | null>;
  from(input: Input): string;
  /** `false` responde FORBIDDEN sin llegar al orquestador. */
  allow?(actor: Actor, resource: Resource): boolean;
}

export interface EndpointSpec<
  In extends z.ZodType,
  Out extends z.ZodType,
  Ev extends AnyEvent | null,
  Er extends ErrorSpecs,
  Ac extends Access,
  R,
> {
  /** Qué hace. Sale en `sloption help` y en `catalog.read`. */
  doc: string;
  /** Por defecto `POST <base>/<nombre>`. `file` responde `content` (base64) como binario con su `mime`. */
  http?: { method: "GET" | "POST"; path: string; response?: "json" | "file" };
  access: Ac;
  input: In;
  output: Out;
  /** El evento que emite, del `events.ts` de un dominio. `null`: no emite. */
  event: Ev;
  errors?: Er;
  scope?: Scope<z.output<In>, R>;
}

// oxlint-disable-next-line no-explicit-any -- el recurso de cada endpoint es distinto
export type AnyEndpoint = EndpointSpec<z.ZodType, z.ZodType, AnyEvent | null, ErrorSpecs, Access, any>;

export function defineEndpoint<
  In extends z.ZodType,
  Out extends z.ZodType,
  Ev extends AnyEvent | null,
  Ac extends Access,
  Er extends ErrorSpecs = {},
  R = never,
>(spec: EndpointSpec<In, Out, Ev, Er, Ac, R>) {
  return spec;
}

export interface RouterSpec<
  Endpoints extends Record<string, AnyEndpoint> = Record<string, AnyEndpoint>,
> {
  /** Prefijo de las acciones: `cards` da `cards.move`. */
  name: string;
  /** Base de las rutas: `/api/cards`. */
  http: string;
  /** Base del comando: `sloption cards move`. */
  cli: string;
  endpoints: Endpoints;
}

export function defineRouter<Endpoints extends Record<string, AnyEndpoint>>(
  router: RouterSpec<Endpoints>,
) {
  return router;
}

type ResourceOf<Ep extends AnyEndpoint> =
  // oxlint-disable-next-line no-explicit-any
  NonNullable<Ep["scope"]> extends Scope<any, infer R> ? R : never;

export interface Context<Ep extends AnyEndpoint, Tx, Deps> {
  actor: Ep["access"] extends "public" ? Actor | null : Actor;
  tx: Tx;
  deps: Deps;
  /** El recurso de `scope`, ya cargado y autorizado. */
  resource: ResourceOf<Ep>;
  /** Tipos de evento que existen: los de los endpoints y los que no salen de uno, como el login. */
  catalog: { events: readonly string[] };
  fail(code: keyof NonNullable<Ep["errors"]> & string, message?: string): never;
}

/** Con evento, el orquestador devuelve exactamente ese evento: otro con la misma forma no compila. */
export type Result<Ep extends AnyEndpoint> = Ep["event"] extends (
  ...args: never[]
) => infer E
  ? { output: z.input<Ep["output"]>; event: E }
  : { output: z.input<Ep["output"]> };

/** Una función por endpoint del router, ni una más ni una menos. */
export type Handlers<Rt extends RouterSpec, Tx, Deps> = {
  [K in keyof Rt["endpoints"]]: (
    input: z.output<Rt["endpoints"][K]["input"]>,
    context: Context<Rt["endpoints"][K], Tx, Deps>,
  ) => Promise<Result<Rt["endpoints"][K]>>;
};

export interface Module {
  router: RouterSpec;
  handlers: Record<
    string,
    (input: unknown, context: never) => Promise<{ output: unknown; event?: unknown }>
  >;
}

export function implement<Rt extends RouterSpec, Tx, Deps>(
  router: Rt,
  handlers: Handlers<Rt, Tx, Deps>,
): Module {
  return { router, handlers: handlers as unknown as Module["handlers"] };
}
