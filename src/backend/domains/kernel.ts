import { z } from "zod";
import {
  implement as implementRouter,
  type ActionEvent,
  type Handlers,
  type RouterSpec,
} from "../lib/endpoint";
import type { Documents, Secrets, Store } from "../lib/ports";
import type { Asset } from "./assets/model";
import type { Invitation, Key, Profile } from "./auth/model";
import type { Board } from "./boards/model";
import type { Card } from "./cards/model";
import type { Field } from "./fields/model";
import type { Webhook } from "./webhooks/model";

/** Lo que comparten los dominios: colecciones, transacción y dependencias. */
export interface Entities {
  profiles: Profile;
  fields: Field;
  cards: Card;
  boards: Board;
  keys: Key;
  invitations: Invitation;
  webhooks: Webhook;
  assets: Asset;
}
export type Collection = keyof Entities;

export interface Tx extends Store<Entities> {
  /** Cuenta de BetterAuth creada dentro de esta misma transacción. */
  createAccount(email: string, password: string, name: string): Promise<string>;
  enqueueDelivery(webhookId: string, event: ActionEvent): Promise<void>;
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
  handlers: Handlers<Rt, Tx, Deps>,
) {
  return implementRouter(router, handlers);
}

export const id = z.string().min(1).max(200);
export const empty = z.object({}).strict();
export const byId = z.object({ id }).strict();
export const ok = z.object({ ok: z.literal(true) }).strict();

export type { Asset, Board, Card, Field, Invitation, Key, Profile, Webhook };
export type { Role } from "./auth/model";
export type { Value } from "./fields/model";
