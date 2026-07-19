/**
 * In-process per-match mutex: serializes state read-modify-write cycles so a
 * bot-runner iteration and a concurrent human action can't clobber each
 * other's saves. The server is a single process (one httpServer in index.ts),
 * so an in-memory promise chain is sufficient.
 */
const chains = new Map<string, Promise<void>>();

export function withMatchLock<T>(matchId: string, fn: () => Promise<T>): Promise<T> {
  const prev = chains.get(matchId) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  const tail: Promise<void> = next.then(
    () => undefined,
    () => undefined,
  ).then(() => {
    // Drop the chain entry once fully drained so the map doesn't grow forever.
    if (chains.get(matchId) === tail) chains.delete(matchId);
  });
  chains.set(matchId, tail);
  return next;
}
