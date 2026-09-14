import { implement } from "../kernel";
import {
  InvitationAccepted,
  InvitationCreated,
  KeyCreated,
  KeyRevoked,
  KeysListed,
  ProfilesListed,
  RoleChanged,
  ThemeChanged,
} from "./events";
import {
  invitationsRouter,
  keysRouter,
  profilesRouter,
  sessionRouter,
} from "./router";
import * as auth from "./services";

export const sessionOrchestrator = implement(sessionRouter, {
  async me(_input, { actor }) {
    return { output: actor };
  },
});

export const profilesOrchestrator = implement(profilesRouter, {
  async preferences(input, { tx, actor }) {
    const profile = await auth.setTheme(tx, actor.userId, input.theme);
    return {
      output: profile,
      event: ThemeChanged({ profileId: profile.id, theme: input.theme }),
    };
  },
  async list(_input, { tx }) {
    return { output: await auth.listProfiles(tx), event: ProfilesListed({}) };
  },
  async update(input, { tx, resource }) {
    const profile = await auth.setRole(tx, resource, input.role);
    return {
      output: profile,
      event: RoleChanged({ profileId: profile.id, role: profile.role }),
    };
  },
});

export const invitationsOrchestrator = implement(invitationsRouter, {
  async create(input, { tx, deps }) {
    const { invitation, token } = await auth.createInvitation(tx, deps, input);
    return {
      output: { id: invitation.id, token },
      event: InvitationCreated({
        invitationId: invitation.id,
        email: invitation.email,
        role: invitation.role,
      }),
    };
  },
  async accept(input, { tx, deps }) {
    const { invitation, profile } = await auth.acceptInvitation(tx, deps, input);
    return {
      output: { ok: true } as const,
      event: InvitationAccepted({
        invitationId: invitation.id,
        profileId: profile.id,
      }),
    };
  },
});

export const keysOrchestrator = implement(keysRouter, {
  async list(_input, { tx, actor }) {
    return {
      output: await auth.listKeys(tx, actor.userId),
      event: KeysListed({}),
    };
  },
  async create(input, { tx, deps, actor }) {
    const { key, token } = await auth.createKey(
      tx,
      deps,
      actor.userId,
      input.name,
    );
    return {
      output: { id: key.id, agentId: key.agentId, token },
      event: KeyCreated({
        keyId: key.id,
        agentId: key.agentId,
        ownerId: key.ownerId,
      }),
    };
  },
  async revoke(_input, { tx, resource: key }) {
    await auth.revokeKey(tx, key);
    return {
      output: { ok: true } as const,
      event: KeyRevoked({ keyId: key.id, agentId: key.agentId }),
    };
  },
});

export const authOrchestrators = [
  sessionOrchestrator,
  profilesOrchestrator,
  invitationsOrchestrator,
  keysOrchestrator,
];
