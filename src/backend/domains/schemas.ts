import { z } from "zod";

/** Los esquemas base que usan todos los dominios. */
export const Id = z.string().min(1).max(200);
export const Empty = z.object({}).strict();
export const ById = z.object({ id: Id }).strict();
export const Ok = z.object({ ok: z.literal(true) }).strict();
