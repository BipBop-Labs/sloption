import { z } from "zod";
import { defineEvent } from "../../lib/endpoint";
import { Id } from "../schemas";
import { Role, Theme } from "./schemas";

const session = z
  .object({ ip: z.string().nullable(), userAgent: z.string().nullable() })
  .strict();

/**
 * Los emite el login de BetterAuth, que no pasa por el catálogo. Se suscriben
 * por webhook igual que cualquier otro: una alerta de acceso es un webhook a
 * `auth.signedIn.v1`.
 */
export const SignedIn = defineEvent("auth.signedIn.v1", {
  data: session,
  refreshesBoard: false,
});
export const SignedOut = defineEvent("auth.signedOut.v1", {
  data: session,
  refreshesBoard: false,
});
export const sessionEvents = [SignedIn, SignedOut];

export const ProfilesListed = defineEvent("profiles.listed.v1", {
  data: z.object({}).strict(),
  refreshesBoard: false,
});

export const ThemeChanged = defineEvent("profiles.themeChanged.v1", {
  data: z.object({ profileId: Id, theme: Theme }).strict(),
  refreshesBoard: true,
});

export const RoleChanged = defineEvent("profiles.roleChanged.v1", {
  data: z.object({ profileId: Id, role: Role }).strict(),
  refreshesBoard: true,
});

export const InvitationCreated = defineEvent("invitations.created.v1", {
  data: z.object({ invitationId: Id, email: z.string(), role: Role }).strict(),
  refreshesBoard: false,
});

export const InvitationAccepted = defineEvent("invitations.accepted.v1", {
  data: z.object({ invitationId: Id, profileId: Id }).strict(),
  refreshesBoard: true,
});

export const KeysListed = defineEvent("keys.listed.v1", {
  data: z.object({}).strict(),
  refreshesBoard: false,
});

/** Crear una key crea su agente, que aparece como persona asignable. */
export const KeyCreated = defineEvent("keys.created.v1", {
  data: z.object({ keyId: Id, agentId: Id, ownerId: Id }).strict(),
  refreshesBoard: true,
});

export const KeyRevoked = defineEvent("keys.revoked.v1", {
  data: z.object({ keyId: Id, agentId: Id }).strict(),
  refreshesBoard: false,
});
