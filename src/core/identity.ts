import { ActionError, type Actor, type UnitOfWork } from "./actions";
import type { Secrets, Transaction } from "./ports";
import { z } from "zod";

/**
 * Quién es el que llama. El adaptador extrae la credencial del transporte que
 * conozca; qué identidad significa esa credencial se decide acá, así vale igual
 * por HTTP, por CLI o por donde entre.
 *
 * Invitation redemption binds a previously inaccessible identity to an auth account.
 */
export function createIdentityService(deps: {
  store: UnitOfWork<Transaction>;
  secrets: Secrets;
  newId(): string;
  now(): Date;
}) {
  return {
    async accept(raw: unknown) {
      const input = z
        .object({
          token: z.string().min(20),
          password: z.string().min(12).max(128),
          name: z.string().trim().min(1).max(100),
        })
        .strict()
        .parse(raw);
      return deps.store.transaction(async (tx) => {
        const invitation = (await tx.list("invitations")).find(
          (item) =>
            item.digest === deps.secrets.digest(input.token) && !item.used,
        );
        if (!invitation)
          throw new ActionError("FORBIDDEN", "Invalid invitation");
        const existing = invitation.profileId
          ? await tx.get("profiles", invitation.profileId)
          : null;
        if (existing?.authUserId)
          throw new ActionError("CONFLICT", "Identity already linked");
        const authUserId = await tx.createAccount(
          invitation.email,
          input.password,
          existing?.name ?? input.name,
        );
        const profile = existing ?? {
          id: deps.newId(),
          name: input.name,
          role: invitation.role,
          authUserId: null,
          kind: "person" as const,
          ownerId: null,
        };
        profile.authUserId = authUserId;
        profile.role = invitation.role;
        await tx.put("profiles", profile);
        invitation.used = true;
        await tx.put("invitations", invitation);
        await tx.appendEvent({
          id: deps.newId(),
          type: "invitation.accept.v1",
          actor: {
            userId: profile.id,
            role: profile.role,
            agentId: null,
            apiKeyId: null,
          },
          occurredAt: deps.now().toISOString(),
          data: { profileId: profile.id },
        });
        return { ok: true };
      });
    },
    /**
     * Una API key actúa como su dueño y con sus permisos; el agente queda
     * anotado aparte para que la auditoría distinga quién movió qué. Una key
     * revocada no autentica.
     */
    async fromApiKey(token: string): Promise<Actor | null> {
      const digest = deps.secrets.digest(token);
      return deps.store.transaction(async (tx) => {
        const key = (await tx.list("keys")).find(
          (item) => item.digest === digest && !item.revoked,
        );
        if (!key) return null;
        const profile = await tx.get("profiles", key.ownerId);
        return profile
          ? {
              userId: profile.id,
              role: profile.role,
              agentId: key.agentId,
              apiKeyId: key.id,
            }
          : null;
      });
    },
    /** El rol sale del perfil, no del usuario de autenticación. */
    async fromSession(authUserId: string): Promise<Actor | null> {
      return deps.store.transaction(async (tx) => {
        const profile = (await tx.list("profiles")).find(
          (item) => item.authUserId === authUserId,
        );
        return profile
          ? {
              userId: profile.id,
              role: profile.role,
              agentId: null,
              apiKeyId: null,
            }
          : null;
      });
    },
    async audit(
      type:
        | "auth.login.v1"
        | "auth.logout.v1"
        | "auth.session.v1"
        | "stream.open.v1",
      actor: Actor,
    ) {
      await deps.store.transaction((tx) =>
        tx.appendEvent({
          id: deps.newId(),
          type,
          actor,
          occurredAt: deps.now().toISOString(),
          data: {},
        }),
      );
    },
  };
}
