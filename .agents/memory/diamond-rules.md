---
name: Diamond action rules (turn, duel, block)
description: Who may take a Diamond action when — turn allowance, attacker in duel, blocking defender — and the state that tracks each.
---

Diamond actions = discard to draw, discard for temp boost, or bank to the Mine.

- **Own turn:** one Diamond action per turn, gated by `player.hasPlayedDiamondThisTurn`
  (reset at that player's own turn start).
- **Duel:** the ATTACKER is the active player, so a duel Diamond counts against their turn
  allowance — barred if they already used one in the main phase, and taking one sets
  `hasPlayedDiamondThisTurn`. The DEFENDER is reacting on someone else's turn and still
  gets their own duel Diamond (per-duel flag). (79b475b)
- **Blocking:** a blocking defender may take one Diamond action (draw or boost only — "To
  Mine" stays turn-only). Tracked per combat in `GameState.blockDiamondUsedBy: string[]`,
  reset by `declareAttack`, because the defender's own `hasPlayedDiamondThisTurn` is stale
  on the attacker's turn. (5706c03)
- `tempBoost` is cleared only at the player's OWN turn start, so a boost taken while
  blocking carries into the duel that follows.

**How to apply:** client gating in `gameUtils.ts` / `match.tsx` mirrors these rules — change
both sides together. Bot block-window Diamond candidates are emitted via
`enumerateCandidateActions`, deliberately NOT inside `declareBlocksCandidates`
(`bestDefenderBlocks` indexes that list positionally: [0] = all-pass, [1] = greedy).
