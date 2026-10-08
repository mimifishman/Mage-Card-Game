---
name: Client freeze / stale board fixes
description: Why the mobile board froze or sat on "Waiting for…", and the safeguards now in place — don't remove them.
---

Reported "freezes" were always the CLIENT, never the server (production action logs show
the bot answering within ~64ms and no server-side stalls). Safeguards (July 27-28, 2026):

1. **Request timeouts** — `lib/api-client-react/src/custom-fetch.ts` aborts after 20s
   (`RequestTimeoutError`, opt out with `timeoutMs: 0`); auth-token lookup capped at 10s.
   `match.tsx` has a 25s watchdog that resets a stuck mutation (every control is
   `disabled={isSubmitting}`, so one hung request disabled the whole board).
2. **Half-open socket** — server sends an app-level heartbeat every 10s
   (`ws/manager.ts`; RN never surfaces protocol pongs, so `ws.ping()` is useless). A client
   silent for 25s lets the state poll through and force-closes the socket to reconnect.
   Do not gate the poll on `wsConnected` alone.
3. **Stale action response** — a POST's `onSuccess` applies its returned state only if no
   pushed state arrived while it was in flight (the bot's push can beat the response).
4. **Bot re-kick backstop** — `GET /:id/state` restarts the bot runner if a bot holds
   priority (client polls every 15s).
5. **Game over** — the final state still has a phase/activePlayerId; waiting strips and
   turn chips are suppressed via `gameOverReveal`.

Bot pacing: `BOT_MOVE_DELAY_MS` 1000, `BIG_MOVE_DELAY_MS` 1600 (`bot/runner.ts`).

**How to apply:** when debugging a "frozen" match, pull the production action log and
`hands_snapshot` before patching — prior "bot misplay" theories were wrong because a
screenshot's face-up row is Royal attachments, not the hand.
