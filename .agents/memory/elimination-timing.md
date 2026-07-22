---
name: Elimination timing vs bot scoring
description: Eliminations apply only at end-of-turn cleanup; mid-turn a 0-life player reads isEliminated false
---

Eliminations are applied only in `endTurnCleanupAndAdvance` (end-of-turn cleanup), never immediately when life hits 0. Mid-turn, a player at 0 life still has `isEliminated: false` and `isGameOver` returns false.

**Why:** This caused the bot to skip game-winning lethal attacks — its evaluator never saw the win and healed instead. Any scorer, UI, or rule that checks "is this player dead" mid-turn must treat `life <= 0` as dead, not rely on `isEliminated` alone.

**How to apply:** When evaluating mid-turn game states (bot scoring, win prediction, UI banners), use `isEliminated || life <= 0`. Threat modeling: turns are round-robin (`advanceTurn`), so ALL living opponents act before the current player's next turn — summing opponents' board attacks for survival threat is correct in multiplayer.

Also: the engine permanently forbids Royal-on-Royal attachments (`attachRoyalSupport` always rejects; old logic kept commented for potential reversal). Don't enumerate `attach_royal_support` as a bot candidate or expect it in tests.
