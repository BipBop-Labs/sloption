import { z } from "zod";

export const actorSchema = z
  .object({
    userId: z.string().min(1),
    role: z.enum(["admin", "member"]),
    agentId: z.string().min(1).nullable(),
    apiKeyId: z.string().min(1).nullable(),
  })
  .strict();

type JsonValue =
  null | string | number | boolean | JsonValue[] | { [key: string]: JsonValue };

export type Actor = z.infer<typeof actorSchema>;
export type ErrorCode =
  "UNAUTHENTICATED" | "FORBIDDEN" | "INVALID_INPUT" | "NOT_FOUND" | "CONFLICT";

export class ActionError extends Error {
  constructor(
    readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ActionError";
  }
}

export const eventSchema = z
  .object({
    id: z.string().uuid(),
    type: z.string().regex(/^[a-z][a-zA-Z]+\.[a-zA-Z]+\.v[1-9][0-9]*$/),
    actor: actorSchema,
    occurredAt: z.iso.datetime(),
    data: z.record(z.string(), z.json()),
  })
  .strict();

export type ActionEvent = z.infer<typeof eventSchema>;

export interface EventTransaction {
  appendEvent(event: ActionEvent): Promise<void>;
}

/** Implementations commit the operation and its event together, or roll both back. */
export interface UnitOfWork<Tx extends EventTransaction> {
  transaction<T>(operation: (transaction: Tx) => Promise<T>): Promise<T>;
}

export interface ActionDefinition<
  Input,
  Output,
  EventData extends Record<string, JsonValue>,
  Tx,
> {
  name: string;
  input: z.ZodType<Input>;
  output: z.ZodType<Output>;
  access: "member" | "admin";
  event: {
    type: string;
    data: z.ZodType<EventData>;
  };
  execute(
    input: Input,
    actor: Actor,
    transaction: Tx,
  ): Promise<{
    output: Output;
    eventData: EventData;
  }>;
}

/** Transport-independent validation, authorization, and atomic audit boundary. */
export function createActionRunner<Tx extends EventTransaction>(dependencies: {
  unitOfWork: UnitOfWork<Tx>;
  newId: () => string;
  now: () => Date;
}) {
  return async function run<
    Input,
    Output,
    EventData extends Record<string, JsonValue>,
  >(
    definition: ActionDefinition<Input, Output, EventData, Tx>,
    rawInput: unknown,
    actor: Actor | null,
  ): Promise<Output> {
    if (!actor)
      throw new ActionError("UNAUTHENTICATED", "Authentication required");
    const identity = actorSchema.parse(actor);
    if (definition.access === "admin" && identity.role !== "admin") {
      throw new ActionError("FORBIDDEN", "Administrator role required");
    }
    const parsed = definition.input.safeParse(rawInput);
    if (!parsed.success)
      throw new ActionError("INVALID_INPUT", "Invalid action parameters");
    return dependencies.unitOfWork.transaction(async (transaction) => {
      const result = await definition.execute(
        parsed.data,
        identity,
        transaction,
      );
      const output = definition.output.parse(result.output);
      const data = definition.event.data.parse(result.eventData);
      await transaction.appendEvent(
        eventSchema.parse({
          id: dependencies.newId(),
          type: definition.event.type,
          actor: identity,
          occurredAt: dependencies.now().toISOString(),
          data,
        }),
      );
      return output;
    });
  };
}
