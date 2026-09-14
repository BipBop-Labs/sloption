import type { Authenticator, Secrets, UnitOfWork } from "../../lib/ports";
import type { Tx } from "../kernel";
import { fromApiKey, fromSession } from "./services";

/**
 * El puerto de lib implementado por auth. El transporte solo extrae la
 * credencial —cabecera o cookie— y pregunta; quién es se decide acá, igual
 * por HTTP, por CLI o por donde entre.
 */
export function createAuthenticator(deps: {
  unitOfWork: UnitOfWork<Tx>;
  secrets: Pick<Secrets, "digest">;
  /** El usuario de BetterAuth detrás de la cookie, o null. */
  sessionUserId(cookie: string): Promise<string | null>;
}): Authenticator {
  return {
    async resolve(credential) {
      if (!credential) return null;
      if (credential.kind === "apiKey") {
        const digest = deps.secrets.digest(credential.token);
        return deps.unitOfWork.transaction((tx) => fromApiKey(tx, digest));
      }
      const authUserId = await deps.sessionUserId(credential.cookie);
      return authUserId
        ? deps.unitOfWork.transaction((tx) => fromSession(tx, authUserId))
        : null;
    },
  };
}
