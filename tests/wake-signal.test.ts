import { expect, it, vi } from "vitest";
import { createWakeSignal } from "../src/adapters/http/wake-signal";
it("does not lose a notification received while reading the database", async () => {
  vi.useFakeTimers();
  const signal = createWakeSignal();
  const observed = signal.revision;
  signal.notify();
  await signal.wait(observed, new AbortController().signal);
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
it("wakes a suspended stream and releases its timeout on abort", async () => {
  vi.useFakeTimers();
  const signal = createWakeSignal();
  const abort = new AbortController();
  const waiting = signal.wait(signal.revision, abort.signal);
  abort.abort();
  await waiting;
  expect(vi.getTimerCount()).toBe(0);
  vi.useRealTimers();
});
