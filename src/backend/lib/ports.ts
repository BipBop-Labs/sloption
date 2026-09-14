import type { ActionEvent, Actor } from "./endpoint";

export interface Entity {
  id: string;
}

/** Lectura y escritura por colección. Qué tabla hay detrás lo decide el adaptador. */
export interface Store<E extends { [K in keyof E]: Entity }> {
  get<K extends keyof E & string>(collection: K, id: string): Promise<E[K] | null>;
  list<K extends keyof E & string>(collection: K): Promise<E[K][]>;
  put<K extends keyof E & string>(collection: K, entity: E[K]): Promise<void>;
  remove(collection: keyof E & string, id: string): Promise<void>;
}

/** Implementations commit the operation and its event together, or roll both back. */
export interface UnitOfWork<Tx> {
  transaction<T>(operation: (transaction: Tx) => Promise<T>): Promise<T>;
}

/** La credencial cruda que trae el transporte. Qué identidad significa no se decide acá. */
export type Credential =
  | { kind: "apiKey"; token: string }
  | { kind: "session"; cookie: string };

/** Lo implementa el dominio auth. La autorización del runner se apoya en esto. */
export interface Authenticator {
  resolve(credential: Credential | null): Promise<Actor | null>;
}

/** Publica un evento dentro de la transacción que lo produjo: si se deshace, no sale. */
export type Publish<Tx> = (
  transaction: Tx,
  event: ActionEvent,
  options: { refreshesBoard: boolean },
) => Promise<void>;

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
