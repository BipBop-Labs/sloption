import type { ActionEvent } from "./endpoint";

/** Implementations commit the operation and its event together, or roll both back. */
export interface UnitOfWork<Tx> {
  transaction<T>(operation: (transaction: Tx) => Promise<T>): Promise<T>;
}

/** La credencial cruda que trae el transporte. Qué identidad significa no se decide acá. */
export type Credential =
  | { kind: "apiKey"; token: string }
  | { kind: "session"; cookie: string };

/** Lo implementa el dominio auth. La autorización del runner se apoya en esto. */
export interface Authenticator<Actor> {
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
