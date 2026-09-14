import { and, asc, count, eq, inArray, isNotNull } from "drizzle-orm";
import { eventSchema } from "../../lib/endpoint";
import { raise } from "../../lib/errors";
import type { Deps, Tx } from "../kernel";
import { invitationErrors, profileErrors } from "./errors";
import { SignedIn, SignedOut } from "./events";
import { apiKeys, invitations, profiles } from "./models";
import type { Actor, Invitation, Key, Profile, Role, Theme } from "./schemas";

/** Una organización por deploy, por ahora. Ver Roadmap en ESTADO.md. */
const ORG_ID = "main";

/** Una key revocada no autentica. La key actúa como su dueño y anota al agente. */
export async function fromApiKey(tx: Tx, digest: string): Promise<Actor | null> {
  const [row] = await tx.sql
    .select({ key: apiKeys, owner: profiles })
    .from(apiKeys)
    .innerJoin(profiles, eq(profiles.id, apiKeys.ownerId))
    .where(and(eq(apiKeys.digest, digest), eq(apiKeys.revoked, false)));
  return row
    ? {
        userId: row.owner.id,
        orgId: ORG_ID,
        role: row.owner.role,
        agentId: row.key.agentId,
        apiKeyId: row.key.id,
      }
    : null;
}

/** El rol sale del perfil, no del usuario de autenticación. */
export async function fromSession(
  tx: Tx,
  authUserId: string,
): Promise<Actor | null> {
  const profile = await one(
    tx.sql.select().from(profiles).where(eq(profiles.authUserId, authUserId)),
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

async function one<T>(query: Promise<T[]>): Promise<T | null> {
  return (await query)[0] ?? null;
}

export const listProfiles = (tx: Tx): Promise<Profile[]> =>
  tx.sql.select().from(profiles).orderBy(asc(profiles.name));

export const profileById = (tx: Tx, profileId: string): Promise<Profile | null> =>
  one(tx.sql.select().from(profiles).where(eq(profiles.id, profileId)));

export async function requireProfile(tx: Tx, profileId: string) {
  return (
    (await profileById(tx, profileId)) ??
    raise(profileErrors, "PROFILE_NOT_FOUND")
  );
}

/** Las personas a asignar tienen que existir. */
export async function assertProfiles(tx: Tx, profileIds: readonly string[]) {
  const wanted = new Set(profileIds);
  if (!wanted.size) return;
  const found = await tx.sql
    .select({ id: profiles.id })
    .from(profiles)
    .where(inArray(profiles.id, [...wanted]));
  if (found.length !== wanted.size) raise(profileErrors, "UNKNOWN_PROFILE");
}

export async function setTheme(tx: Tx, profileId: string, theme: Theme) {
  const profile = await requireProfile(tx, profileId);
  await tx.sql.update(profiles).set({ theme }).where(eq(profiles.id, profileId));
  return { ...profile, theme };
}

export async function setRole(tx: Tx, profile: Profile, role: Role) {
  if (profile.role === "admin" && role === "member") {
    const [active] = await tx.sql
      .select({ admins: count() })
      .from(profiles)
      .where(and(eq(profiles.role, "admin"), isNotNull(profiles.authUserId)));
    if ((active?.admins ?? 0) <= 1) raise(profileErrors, "LAST_ADMIN");
  }
  await tx.sql.update(profiles).set({ role }).where(eq(profiles.id, profile.id));
  return { ...profile, role };
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
  await tx.sql.insert(invitations).values(invitation);
  return { invitation, token };
}

/** Liga una identidad sin acceso, nueva o existente, a una cuenta de BetterAuth. */
export async function acceptInvitation(
  tx: Tx,
  deps: Deps,
  input: { token: string; password: string; name: string },
) {
  const invitation = await one(
    tx.sql
      .select()
      .from(invitations)
      .where(
        and(
          eq(invitations.digest, deps.secrets.digest(input.token)),
          eq(invitations.used, false),
        ),
      ),
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
  let profile: Profile;
  if (existing) {
    profile = { ...existing, authUserId, role: invitation.role };
    await tx.sql
      .update(profiles)
      .set({ authUserId, role: invitation.role })
      .where(eq(profiles.id, existing.id));
  } else {
    profile = {
      id: deps.newId(),
      name: input.name,
      role: invitation.role,
      kind: "person",
      theme: null,
      authUserId,
      ownerId: null,
    };
    await tx.sql.insert(profiles).values(profile);
  }
  await tx.sql
    .update(invitations)
    .set({ used: true })
    .where(eq(invitations.id, invitation.id));
  return { invitation, profile };
}

export const keyById = (tx: Tx, keyId: string): Promise<Key | null> =>
  one(tx.sql.select().from(apiKeys).where(eq(apiKeys.id, keyId)));

export const listKeys = (tx: Tx, ownerId: string) =>
  tx.sql
    .select({
      id: apiKeys.id,
      ownerId: apiKeys.ownerId,
      agentId: apiKeys.agentId,
      name: apiKeys.name,
      revoked: apiKeys.revoked,
    })
    .from(apiKeys)
    .where(eq(apiKeys.ownerId, ownerId));

/** Cada key tiene su agente: un perfil propio que se puede asignar a tarjetas. */
export async function createKey(
  tx: Tx,
  deps: Deps,
  ownerId: string,
  name: string,
) {
  const token = `slop_${deps.secrets.create()}`;
  const agentId = deps.newId();
  await tx.sql.insert(profiles).values({
    id: agentId,
    name,
    role: "member",
    kind: "agent",
    theme: null,
    authUserId: null,
    ownerId,
  });
  const key: Key = {
    id: deps.newId(),
    ownerId,
    agentId,
    name,
    digest: deps.secrets.digest(token),
    revoked: false,
  };
  await tx.sql.insert(apiKeys).values(key);
  return { key, token };
}

export async function revokeKey(tx: Tx, key: Key) {
  await tx.sql.update(apiKeys).set({ revoked: true }).where(eq(apiKeys.id, key.id));
}

export function sessionEvent(
  kind: "login" | "logout",
  actor: Actor,
  meta: { ip: string | null; userAgent: string | null },
  deps: Pick<Deps, "newId" | "now">,
) {
  const emitted = (kind === "login" ? SignedIn : SignedOut)(meta);
  return eventSchema.parse({
    id: deps.newId(),
    type: emitted.type,
    actor,
    occurredAt: deps.now().toISOString(),
    data: emitted.data,
  });
}
