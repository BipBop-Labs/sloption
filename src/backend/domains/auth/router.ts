import { z } from "zod";
import { defineEndpoint, defineRouter } from "../../lib/endpoint";
import { ById, Empty, Ok } from "../schemas";
import { invitationErrors, profileErrors } from "./errors";
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
  Actor,
  InvitationAcceptance,
  IssuedInvitation,
  IssuedKey,
  KeySummary,
  NewInvitation,
  NewKey,
  Profile,
  RoleAssignment,
  ThemeChoice,
} from "./schemas";
import * as auth from "./services";

export const sessionRouter = defineRouter({
  name: "session",
  http: "/api/session",
  cli: "session",
  endpoints: {
    me: defineEndpoint({
      doc: "Quién llama. userId es la persona dueña de la clave y agentId el perfil del agente: ese agentId es el que se asigna a una tarjeta.",
      http: { method: "GET", path: "/me" },
      access: "member",
      input: Empty,
      output: Actor,
      event: null,
    }),
  },
});

export const profilesRouter = defineRouter({
  name: "profiles",
  http: "/api/profiles",
  cli: "profiles",
  endpoints: {
    preferences: defineEndpoint({
      doc: "Guarda el tema de quien llama: light, dark o system.",
      access: "member",
      input: ThemeChoice,
      output: Profile,
      event: ThemeChanged,
      errors: profileErrors,
    }),
    list: defineEndpoint({
      doc: "Personas y agentes.",
      access: "member",
      input: Empty,
      output: z.array(Profile),
      event: ProfilesListed,
    }),
    update: defineEndpoint({
      doc: "Cambia el rol de una persona. Siempre queda al menos un administrador con acceso.",
      access: "admin",
      input: RoleAssignment,
      output: Profile,
      scope: { load: auth.profileById, from: (input) => input.id },
      event: RoleChanged,
      errors: profileErrors,
    }),
  },
});

export const invitationsRouter = defineRouter({
  name: "invitations",
  http: "/api/invitations",
  cli: "invitations",
  endpoints: {
    create: defineEndpoint({
      doc: "Crea una invitación de un uso y devuelve su token. No envía correo: el enlace se comparte a mano. Con profileId liga una identidad existente.",
      access: "admin",
      input: NewInvitation,
      output: IssuedInvitation,
      event: InvitationCreated,
      errors: { ...profileErrors, ...invitationErrors },
    }),
    accept: defineEndpoint({
      doc: "Canjea una invitación: crea la cuenta y la liga al perfil. No pide sesión.",
      access: "public",
      input: InvitationAcceptance,
      output: Ok,
      event: InvitationAccepted,
      errors: invitationErrors,
    }),
  },
});

export const keysRouter = defineRouter({
  name: "keys",
  http: "/api/keys",
  cli: "keys",
  endpoints: {
    list: defineEndpoint({
      doc: "Tus API keys. Nunca devuelve el token.",
      access: "member",
      input: Empty,
      output: z.array(KeySummary),
      event: KeysListed,
    }),
    create: defineEndpoint({
      doc: "Crea un agente y su API key. La key actúa con tus permisos. El token solo se devuelve acá.",
      access: "member",
      input: NewKey,
      output: IssuedKey,
      event: KeyCreated,
    }),
    revoke: defineEndpoint({
      doc: "Revoca una API key propia. Deja de autenticar en la próxima llamada.",
      access: "member",
      input: ById,
      output: Ok,
      scope: {
        load: auth.keyById,
        from: (input) => input.id,
        allow: (actor, key) => key.ownerId === actor.userId,
      },
      event: KeyRevoked,
    }),
  },
});
