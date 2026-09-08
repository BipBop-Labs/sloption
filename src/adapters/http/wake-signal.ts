/** Revision tokens prevent losing a notification between fetching events and waiting. */
export function createWakeSignal() {
  let revision = 0;
  const waiting = new Set<() => void>();
  return {
    get revision() {
      return revision;
    },
    notify() {
      revision++;
      for (const wake of waiting) wake();
    },
    wait(
      observed: number,
      signal: AbortSignal,
      timeoutMs = 15000,
    ): Promise<void> {
      if (observed !== revision || signal.aborted) return Promise.resolve();
      return new Promise((resolve) => {
        const finish = () => {
          clearTimeout(timer);
          waiting.delete(finish);
          signal.removeEventListener("abort", finish);
          resolve();
        };
        const timer = setTimeout(finish, timeoutMs);
        waiting.add(finish);
        signal.addEventListener("abort", finish, { once: true });
      });
    },
  };
}
