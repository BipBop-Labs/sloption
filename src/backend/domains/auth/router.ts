import { z } from "zod";
import { actorSchema, defineEndpoint, defineRouter } from "../../lib/endpoint";
import { byId, empty, id, ok } from "../kernel";
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
import { keySchema, profileSchema, roleSchema, themeSchema } from "./model";
import * as auth from "./services";

export const sessionRouter = defineRouter({
  name: "session",
  http: "/api/session",
  cli: "session",
  endpoints: {
    me: defineEndpoint({
      doc: "Quién llama. userId es la persona dueña de la clave y agentId el perfil del agente: ese agentId es el que va en un campo people para asignarte algo.",
      http: { method: "GET", path: "/me" },
      access: "member",
      input: empty,
      output: actorSchema,
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
      input: z.object({ theme: themeSchema }).strict(),
      output: profileSchema,
      event: ThemeChanged,
      errors: profileErrors,
    }),
    list: defineEndpoint({
      doc: "Personas y agentes.",
      access: "member",
      input: empty,
      output: z.array(profileSchema),
      event: ProfilesListed,
    }),
    update: defineEndpoint({
      doc: "Cambia el rol de una persona. Siempre queda al menos un administrador con acceso.",
      access: "admin",
      input: z.object({ id, role: roleSchema }).strict(),
      output: profileSchema,
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
      input: z
        .object({
          email: z.email(),
          role: roleSchema,
          profileId: id.nullable().default(null),
        })
        .strict(),
      output: z.object({ id, token: z.string() }).strict(),
      event: InvitationCreated,
      errors: { ...profileErrors, ...invitationErrors },
    }),
    accept: defineEndpoint({
      doc: "Canjea una invitación: crea la cuenta y la liga al perfil. No pide sesión.",
      access: "public",
      input: z
        .object({
          token: z.string().min(20),
          password: z.string().min(12).max(128),
          name: z.string().trim().min(1).max(100),
        })
        .strict(),
      output: ok,
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
      input: empty,
      output: z.array(keySchema),
      event: KeysListed,
    }),
    create: defineEndpoint({
      doc: "Crea un agente y su API key. La key actúa con tus permisos. El token solo se devuelve acá.",
      access: "member",
      input: z.object({ name: z.string().trim().min(1).max(100) }).strict(),
      output: z.object({ id, agentId: id, token: z.string() }).strict(),
      event: KeyCreated,
    }),
    revoke: defineEndpoint({
      doc: "Revoca una API key propia. Deja de autenticar en la próxima llamada.",
      access: "member",
      input: byId,
      output: ok,
      scope: {
        load: auth.keyById,
        from: (input) => input.id,
        allow: (actor, key) => key.ownerId === actor.userId,
      },
      event: KeyRevoked,
    }),
  },
});
