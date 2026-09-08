import type { ActionEvent, EventTransaction } from "./actions";
import type { Collection, Entities } from "./model";
export interface Transaction extends EventTransaction {
  createAccount(email: string, password: string, name: string): Promise<string>;
  get<K extends Collection>(
    collection: K,
    id: string,
  ): Promise<Entities[K] | null>;
  list<K extends Collection>(collection: K): Promise<Entities[K][]>;
  put<K extends Collection>(collection: K, entity: Entities[K]): Promise<void>;
  remove(collection: Collection, id: string): Promise<void>;
  history(
    before: number | undefined,
    limit: number,
    includeReads: boolean,
  ): Promise<(ActionEvent & { sequence: number })[]>;
}
export interface Documents {
  initialize(markdown: string): string;
  merge(
    current: string | null,
    markdown: string,
    update: string,
  ): { document: string; markdown: string };
}
export interface Secrets {
  create(): string;
  digest(value: string): string;
}
