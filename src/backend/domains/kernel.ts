import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  implement as implementRouter,
  type Handlers,
  type RouterSpec,
} from "../lib/endpoint";
import type { Documents, Secrets } from "../lib/ports";
import type { Actor } from "./auth/schemas";

/** La transacción de Drizzle. Los servicios consultan las tablas de `models.ts` con ella. */
export type Sql = Parameters<Parameters<NodePgDatabase["transaction"]>[0]>[0];

/** Lo que comparten los dominios: la transacción y las dependencias. */
export interface Tx {
  sql: Sql;
  /** Cuenta de BetterAuth creada dentro de esta misma transacción. */
  createAccount(email: string, password: string, name: string): Promise<string>;
  /** Corre después del commit. Si la transacción se deshace, no corre. */
  afterCommit(task: () => void): void;
  /** Avisa a los navegadores abiertos que el tablero cambió. */
  notify(type: string): Promise<void>;
}

export interface Deps {
  newId(): string;
  now(): Date;
  secrets: Secrets;
  documents: Documents;
}

export function implement<Rt extends RouterSpec>(
  router: Rt,
  handlers: Handlers<Rt, Tx, Deps, Actor>,
) {
  return implementRouter(router, handlers);
}

export type { Asset } from "./assets/schemas";
export type { Actor, Invitation, Key, Profile, Role } from "./auth/schemas";
export type { Board, BoardState } from "./boards/schemas";
export type { Card, CardSummary } from "./cards/schemas";
export type { Field, Value } from "./fields/schemas";
export type { Webhook } from "./webhooks/schemas";
