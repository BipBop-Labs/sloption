import { z } from "zod";
import { Id } from "../schemas";

export const Role = z.enum(["admin", "member"]);
export type Role = z.infer<typeof Role>;

export const Theme = z.enum(["light", "dark", "system"]);
export type Theme = z.infer<typeof Theme>;

const Name = z.string().trim().min(1).max(100);

export const Profile = z
  .object({
    theme: Theme.optional(),
    id: Id,
    name: z.string(),
    role: Role,
    authUserId: z.string().nullable(),
    ownerId: z.string().nullable(),
    kind: z.enum(["person", "agent"]),
  })
  .strict();
export type Profile = z.infer<typeof Profile>;

/** Una API key guardada. El digest nunca sale por API: ver `KeySummary`. */
export const Key = z
  .object({
    id: Id,
    ownerId: Id,
    agentId: Id,
    name: z.string(),
    digest: z.string(),
    revoked: z.boolean(),
  })
  .strict();
export type Key = z.infer<typeof Key>;

export const KeySummary = Key.omit({ digest: true });

export const Invitation = z
  .object({
    id: Id,
    profileId: Id.nullable(),
    email: z.string(),
    role: Role,
    digest: z.string(),
    used: z.boolean(),
  })
  .strict();
export type Invitation = z.infer<typeof Invitation>;

export const ThemeChoice = z.object({ theme: Theme }).strict();

export const RoleAssignment = z.object({ id: Id, role: Role }).strict();

/** Con `profileId`, la invitación liga una identidad que ya existe sin acceso. */
export const NewInvitation = z
  .object({
    email: z.email(),
    role: Role,
    profileId: Id.nullable().default(null),
  })
  .strict();

/** El token solo se devuelve al crearla: es lo que va en el enlace. */
export const IssuedInvitation = z.object({ id: Id, token: z.string() }).strict();

export const InvitationAcceptance = z
  .object({
    token: z.string().min(20),
    password: z.string().min(12).max(128),
    name: Name,
  })
  .strict();

export const NewKey = z.object({ name: Name }).strict();

/** El token solo se devuelve al crearla. */
export const IssuedKey = z
  .object({ id: Id, agentId: Id, token: z.string() })
  .strict();
