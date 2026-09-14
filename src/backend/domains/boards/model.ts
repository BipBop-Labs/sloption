import { z } from "zod";
import { id } from "../kernel";

export const boardSchema = z
  .object({ id, name: z.string(), groupingId: id })
  .strict();
export type Board = z.infer<typeof boardSchema>;
