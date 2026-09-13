import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  createActionRunner,
  type ActionEvent,
  type Actor,
} from "../src/backend/core/actions";
import {
  parsePropertyValue,
  removeOptionReference,
  type Property,
} from "../src/backend/core/properties";

const actor: Actor = {
  userId: "owner",
  role: "member",
  agentId: "agent",
  apiKeyId: "key",
};

function fixture(failEvent = false) {
  let storedValue = 0;
  const events: ActionEvent[] = [];
  const run = createActionRunner({
    now: () => new Date("2026-09-08T12:00:00Z"),
    newId: () => "2d3fc8b4-9a11-4b77-a828-45fed3d69e71",
    unitOfWork: {
      async transaction<T>(
        operation: (tx: {
          setValue(value: number): void;
          appendEvent(event: ActionEvent): Promise<void>;
        }) => Promise<T>,
      ) {
        let pendingValue = storedValue;
        const pendingEvents: ActionEvent[] = [];
        const result = await operation({
          setValue: (value) => {
            pendingValue = value;
          },
          async appendEvent(event) {
            if (failEvent) throw new Error("Storage failure");
            pendingEvents.push(event);
          },
        });
        storedValue = pendingValue;
        events.push(...pendingEvents);
        return result;
      },
    },
  });
  const action = {
    name: "sample.set",
    access: "member" as const,
    input: z.object({ value: z.number() }).strict(),
    output: z.number(),
    event: {
      type: "sample.changed.v1",
      data: z.object({ value: z.number() }).strict(),
    },
    async execute(
      input: { value: number },
      _actor: Actor,
      tx: { setValue(value: number): void },
    ) {
      tx.setValue(input.value);
      return { output: input.value, eventData: input };
    },
  };
  return { run, action, events, value: () => storedValue };
}

describe("action boundary", () => {
  it("records both the owner and agent on a successful action", async () => {
    const f = fixture();
    expect(await f.run(f.action, { value: 7 }, actor)).toBe(7);
    expect(f.events).toHaveLength(1);
    expect(f.events[0]?.actor).toEqual(actor);
    expect(f.value()).toBe(7);
  });

  it("does not commit a change when its event cannot be stored", async () => {
    const f = fixture(true);
    await expect(f.run(f.action, { value: 7 }, actor)).rejects.toThrow(
      "Storage failure",
    );
    expect(f.value()).toBe(0);
    expect(f.events).toEqual([]);
  });

  it("rejects unauthenticated and unauthorized calls before execution", async () => {
    const f = fixture();
    await expect(f.run(f.action, { value: 7 }, null)).rejects.toMatchObject({
      code: "UNAUTHENTICATED",
    });
    await expect(
      f.run({ ...f.action, access: "admin" }, { value: 7 }, actor),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(f.value()).toBe(0);
  });

  it("rejects malformed inputs without events or state changes", async () => {
    const f = fixture();
    await expect(f.run(f.action, { value: "7" }, actor)).rejects.toMatchObject({
      code: "INVALID_INPUT",
    });
    expect(f.events).toEqual([]);
  });
});

describe("property values", () => {
  const property: Property = {
    id: "category",
    name: "Categoría",
    type: "multiSelect",
    options: [
      { id: "swe", label: "SWE" },
      { id: "product", label: "Producto" },
    ],
  };
  it("accepts empty values and rejects dangling selections", () => {
    expect(parsePropertyValue(property, null, new Set())).toBeNull();
    expect(parsePropertyValue(property, ["swe"], new Set())).toEqual(["swe"]);
    expect(() =>
      parsePropertyValue(property, ["missing"], new Set()),
    ).toThrow();
    expect(() =>
      parsePropertyValue(property, ["swe", "swe"], new Set()),
    ).toThrow();
  });
  it("clears only the removed option", () => {
    expect(removeOptionReference(["swe", "product"], "swe")).toEqual([
      "product",
    ]);
    expect(removeOptionReference("swe", "swe")).toBeNull();
  });
  it("validates calendar dates and finite numbers", () => {
    expect(() =>
      parsePropertyValue(
        { ...property, type: "date" },
        "2026-02-30",
        new Set(),
      ),
    ).toThrow();
    expect(() =>
      parsePropertyValue({ ...property, type: "number" }, Infinity, new Set()),
    ).toThrow();
  });
});
