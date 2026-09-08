import { ActionError, type Actor, type UnitOfWork } from "./actions";
import type { Secrets, Transaction } from "./ports";
import { z } from "zod";

/** Invitation redemption binds a previously inaccessible identity to an auth account. */
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
