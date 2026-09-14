import { z } from "zod";
import { id } from "../kernel";

export const roleSchema = z.enum(["admin", "member"]);
export type Role = z.infer<typeof roleSchema>;

export const themeSchema = z.enum(["light", "dark", "system"]);

export const profileSchema = z
  .object({
    theme: themeSchema.optional(),
    id,
    name: z.string(),
    role: roleSchema,
    authUserId: z.string().nullable(),
    ownerId: z.string().nullable(),
    kind: z.enum(["person", "agent"]),
  })
  .strict();
export type Profile = z.infer<typeof profileSchema>;

export interface Key {
  id: string;
  ownerId: string;
  agentId: string;
  name: string;
  digest: string;
  revoked: boolean;
}
/** La key tal como sale por API: nunca con su digest. */
export const keySchema = z
  .object({
    id,
    ownerId: id,
    agentId: id,
    name: z.string(),
    revoked: z.boolean(),
  })
  .strict();

export interface Invitation {
  id: string;
  profileId: string | null;
  email: string;
  role: Role;
  digest: string;
  used: boolean;
}
