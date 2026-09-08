export type Role = "admin" | "member";
export type Value = string | number | string[] | null;
export interface Profile {
  theme?: "light" | "dark";
  id: string;
  name: string;
  role: Role;
  authUserId: string | null;
  ownerId: string | null;
  kind: "person" | "agent";
}
export interface Field {
  id: string;
  name: string;
  type: "text" | "number" | "date" | "select" | "multiSelect" | "people";
  options: { id: string; label: string }[];
}
export interface Card {
  id: string;
  title: string;
  markdown: string;
  document: string | null;
  values: Record<string, Value>;
  weekly: boolean;
  archived: boolean;
  /** Etiqueta de la etapa al archivar. Copia, no referencia a la opción. */
  archivedStage: string | null;
  rank: number;
  version: number;
  createdAt: string;
  updatedAt: string;
  sourceId: string | null;
  bodyMissing: boolean;
}
export interface Board {
  id: string;
  name: string;
  groupingId: string;
}
export interface Key {
  id: string;
  ownerId: string;
  agentId: string;
  name: string;
  digest: string;
  revoked: boolean;
}
export interface Invitation {
  id: string;
  profileId: string | null;
  email: string;
  role: Role;
  digest: string;
  used: boolean;
}
export interface Webhook {
  id: string;
  url: string;
  events: string[];
  secret: string;
  enabled: boolean;
}
export interface Asset {
  id: string;
  mime: string;
  content: string;
  name: string;
}
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
