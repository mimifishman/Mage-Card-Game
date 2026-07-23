---
name: Elimination timing
description: Reaching 0 life eliminates immediately and decides the game; applyStateBasedActions runs inside dispatchAction
---

Reaching 0 life is **final and immediate**. `applyStateBasedActions` (turn.ts) runs at the end of every `dispatchAction`, so any player at 0 life is eliminated before the state is handed back, and the game ends the moment one player is left standing. `isEliminated` and `life <= 0` therefore always agree in any state that came out of the dispatcher.

**How to apply:** check `isEliminated` (or `isGameOver`) — do NOT add `|| life <= 0` workarounds to scorers, UI, or rules. If you see one, it is a leftover from the old behaviour. `dispatchAction` also rejects every action once `isGameOver`, and `discardHeartToHeal` rejects an eliminated target, so a player can never be healed back above 0.

**Previous behaviour (changed 2026-07-23, do not restore):** eliminations were applied only in `endTurnCleanupAndAdvance`, so mid-turn a 0-life player read `isEliminated: false` and stayed targetable — and healable — until the turn ended. That made a game-winning swing invisible to the bot's one-ply evaluator, which healed instead of taking lethal. The workaround at the time was to treat `life <= 0` as dead everywhere; the engine now guarantees it instead. Ruling from the game owner: "once a player hits 0 life they can't heal back and the game should be over at that point."

**Mid-turn elimination cleanup:** `getTurnHolderId` derives priority from `state.attacks`, `duelContext` and `pendingClubDebuff`. Eliminating someone mid-combat therefore has to prune those and unwind a phase whose holder just died, or a 3-4 player match deadlocks. `applyStateBasedActions` does this; keep it in mind before adding a new phase whose holder is not `activePlayerId`.

**Match completion:** `applyResultAndBroadcast` (services/matchStart.ts) keys off `isGameOver`, so `finishMatch` and the `game_over` broadcast now fire on the killing blow rather than at end of turn.

**Threat modeling** (unchanged): turns are round-robin (`advanceTurn`), so ALL living opponents act before the current player's next turn — summing opponents' board attacks for survival threat is correct in multiplayer.

**Royal-on-Royal is permanently forbidden** (confirmed by the game owner, 2026-07-23): a Royal can never be played onto another Royal. `attachRoyalSupport` always rejects; the old logic is kept commented beneath it, and `royalSupportBuff` (J +1/+2, Q +2/+3, K +3/+4) is still exported and tested, but neither is reachable. Don't enumerate `attach_royal_support` as a bot candidate or expect it in tests. The action type still exists in the OpenAPI spec, the generated clients, and a request-builder switch in mobile `match.tsx`, but no UI path constructs it.
