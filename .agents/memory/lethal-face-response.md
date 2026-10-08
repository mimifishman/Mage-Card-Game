---
name: Lethal face damage response window
description: A Club/Joker face burn that would kill opens respond_to_club so the defender can heal first; non-lethal burns still land immediately.
---

When a Club or Joker's damage to a player's **face** (life, not a Royal) would take a live
opponent to <= 0, it does NOT apply immediately. It opens the existing `respond_to_club`
phase with `pendingClubDebuff.faceDamage = { sourceCardId, amount }` and **no
`targetRoyalId`**. `confirmClubResponse` applies the stored damage on Accept; the
dispatcher's `applyStateBasedActions` then eliminates only if the defender is still <= 0,
so a Heart played before Accept saves them. (Added 2026-07-26, commits 3acb46e / 6d58a96.)

**Why:** Playtest feedback — combined with immediate elimination at 0 life, a killing
face burn was unanswerable. Owner's ruling: lethal-only, applies to both Clubs and Jokers.
Non-lethal and self-targeted burns resolve immediately as before.

**How to apply:**
- `pendingClubDebuff.targetRoyalId` is now OPTIONAL. Any client/engine code that reads it
  must handle `undefined` (mobile `match.tsx` derives `isFaceClubResponse`; feeding an
  undefined cardId into `CardView` crashes and strands the defender).
- Bot: `respondToClubCandidates` offers `discard_heart_to_heal` for a face-damage pending;
  attacker scoring is unaffected because `settleForScoring` auto-confirms the window.
- Tests that expect a lethal face burn to kill must drive play + confirm (see
  clubs/joker/lifeEvents/turn tests). Bot guard tests in bot.test.ts cover "heal instead
  of accepting" — match a427fd1d was NOT a bot misplay (its hand was empty).
- `faceDamage` and the `royal_destroyed` LifeEvent are read via casts on the client;
  they are not yet in `openapi.yaml` (see openapi-spec-drift.md).
