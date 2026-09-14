import { eventSchema, type Actor } from "../../lib/endpoint";
import { raise } from "../../lib/errors";
import type { Deps, Tx } from "../kernel";
import { invitationErrors, profileErrors } from "./errors";
import { sessionEventData } from "./events";
import type { Invitation, Key, Profile, Role } from "./model";

/** Una organización por deploy, por ahora. Ver Roadmap en ESTADO.md. */
const ORG_ID = "main";

/**
 * Una API key actúa como su dueño y con sus permisos; el agente queda anotado
 * aparte para que los eventos distingan quién movió qué. Una key revocada no
 * autentica.
 */
export async function fromApiKey(tx: Tx, digest: string): Promise<Actor | null> {
  const key = (await tx.list("keys")).find(
    (item) => item.digest === digest && !item.revoked,
  );
  if (!key) return null;
  const owner = await tx.get("profiles", key.ownerId);
  return owner
    ? {
        userId: owner.id,
        orgId: ORG_ID,
        role: owner.role,
        agentId: key.agentId,
        apiKeyId: key.id,
      }
    : null;
}

/** El rol sale del perfil, no del usuario de autenticación. */
export async function fromSession(
  tx: Tx,
  authUserId: string,
): Promise<Actor | null> {
  const profile = (await tx.list("profiles")).find(
    (item) => item.authUserId === authUserId,
  );
  return profile
    ? {
        userId: profile.id,
        orgId: ORG_ID,
        role: profile.role,
        agentId: null,
        apiKeyId: null,
      }
    : null;
}

export const listProfiles = (tx: Tx) => tx.list("profiles");
export const profileById = (tx: Tx, profileId: string) =>
  tx.get("profiles", profileId);

export async function profileIds(tx: Tx) {
  return new Set((await listProfiles(tx)).map((profile) => profile.id));
}

export async function requireProfile(tx: Tx, profileId: string) {
  return (
    (await profileById(tx, profileId)) ??
    raise(profileErrors, "PROFILE_NOT_FOUND")
  );
}

export async function setTheme(
  tx: Tx,
  profileId: string,
  theme: NonNullable<Profile["theme"]>,
) {
  const profile = await requireProfile(tx, profileId);
  profile.theme = theme;
  await tx.put("profiles", profile);
  return profile;
}

export async function setRole(tx: Tx, profile: Profile, role: Role) {
  if (
    profile.role === "admin" &&
    role === "member" &&
    (await listProfiles(tx)).filter(
      (item) => item.role === "admin" && item.authUserId,
    ).length <= 1
  )
    raise(profileErrors, "LAST_ADMIN");
  profile.role = role;
  await tx.put("profiles", profile);
  return profile;
}

/** Identidades importadas: existen como miembros sin acceso hasta que acepten una invitación. */
export async function importPeople(tx: Tx, profiles: Profile[]) {
  for (const profile of profiles)
    if (!(await profileById(tx, profile.id)))
      await tx.put("profiles", {
        ...profile,
        role: "member",
        authUserId: null,
        ownerId: null,
        kind: "person",
      });
}

export async function createInvitation(
  tx: Tx,
  deps: Deps,
  input: { email: string; role: Role; profileId: string | null },
) {
  if (input.profileId) {
    const profile = await requireProfile(tx, input.profileId);
    if (profile.authUserId) raise(invitationErrors, "IDENTITY_LINKED");
  }
  const token = deps.secrets.create();
  const invitation: Invitation = {
    id: deps.newId(),
    ...input,
    email: input.email.toLowerCase(),
    digest: deps.secrets.digest(token),
    used: false,
  };
  await tx.put("invitations", invitation);
  return { invitation, token };
}

/** Liga una identidad sin acceso, nueva o importada, a una cuenta de BetterAuth. */
export async function acceptInvitation(
  tx: Tx,
  deps: Deps,
  input: { token: string; password: string; name: string },
) {
  const digest = deps.secrets.digest(input.token);
  const invitation = (await tx.list("invitations")).find(
    (item) => item.digest === digest && !item.used,
  );
  if (!invitation) return raise(invitationErrors, "INVALID_INVITATION");
  const existing = invitation.profileId
    ? await profileById(tx, invitation.profileId)
    : null;
  if (existing?.authUserId) raise(invitationErrors, "IDENTITY_LINKED");
  const authUserId = await tx.createAccount(
    invitation.email,
    input.password,
    existing?.name ?? input.name,
  );
  const profile: Profile = existing ?? {
    id: deps.newId(),
    name: input.name,
    role: invitation.role,
    authUserId: null,
    kind: "person",
    ownerId: null,
  };
  profile.authUserId = authUserId;
  profile.role = invitation.role;
  await tx.put("profiles", profile);
  invitation.used = true;
  await tx.put("invitations", invitation);
  return { invitation, profile };
}

export const keyById = (tx: Tx, keyId: string) => tx.get("keys", keyId);

export async function listKeys(tx: Tx, ownerId: string) {
  return (await tx.list("keys"))
    .filter((key) => key.ownerId === ownerId)
    .map(({ digest: _digest, ...key }) => key);
}

/** Cada key tiene su agente: un perfil propio que se puede asignar a tarjetas. */
export async function createKey(
  tx: Tx,
  deps: Deps,
  ownerId: string,
  name: string,
) {
  const token = `slop_${deps.secrets.create()}`;
  const agentId = deps.newId();
  await tx.put("profiles", {
    id: agentId,
    name,
    role: "member",
    authUserId: null,
    ownerId,
    kind: "agent",
  });
  const key: Key = {
    id: deps.newId(),
    ownerId,
    agentId,
    name,
    digest: deps.secrets.digest(token),
    revoked: false,
  };
  await tx.put("keys", key);
  return { key, token };
}

export async function revokeKey(tx: Tx, key: Key) {
  key.revoked = true;
  await tx.put("keys", key);
}

export function sessionEvent(
  kind: "login" | "logout",
  actor: Actor,
  meta: { ip: string | null; userAgent: string | null },
  deps: Pick<Deps, "newId" | "now">,
) {
  return eventSchema.parse({
    id: deps.newId(),
    type: `auth.${kind}.v1`,
    actor,
    occurredAt: deps.now().toISOString(),
    data: sessionEventData.parse(meta),
  });
}
