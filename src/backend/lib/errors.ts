/**
 * Cómo ve un error cada transporte. Acá no vive ningún error de negocio: cada
 * dominio declara los suyos (`STALE_VERSION`, `TARGET_MOVED`) y elige uno de
 * estos kinds, que decide el status HTTP y el exit code de la CLI.
 */
export type ErrorKind =
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "INVALID_INPUT"
  | "NOT_FOUND"
  | "CONFLICT";

export interface ErrorSpec {
  kind: ErrorKind;
  message: string;
}
export type ErrorSpecs = Record<string, ErrorSpec>;

export class ActionError extends Error {
  constructor(
    readonly kind: ErrorKind,
    message: string,
    readonly code: string = kind,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

/** Los errores de un dominio. La clave es el código que ve quien llama. */
export function defineErrors<const E extends ErrorSpecs>(errors: E): E {
  return errors;
}

/** Lanza un error declarado; `message` reemplaza el genérico cuando hace falta el detalle. */
export function raise<E extends ErrorSpecs>(
  errors: E,
  code: keyof E & string,
  message?: string,
): never {
  const spec = errors[code]!;
  throw new ActionError(spec.kind, message ?? spec.message, code);
}

export const httpStatus = {
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  CONFLICT: 409,
} as const satisfies Record<ErrorKind, number>;
