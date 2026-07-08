---
name: Combat overhaul rules
description: Six mechanics rules implemented; key type/function changes to know about for future work.
---

## Rules and their engine/UI impact

**Rule 1** — Attacker chooses which Royals attack: `declareAttack(state, attackerPlayerId, targetPlayerId, royalCardIds: CardId[])` now takes 4 args (not 3). UI: attack-select mode in match.tsx with Royal toggles.

**Rule 2** — Multi-blocker: `AttackDeclaration.blockerCardIds?: CardId[]` (was `blockerCardId`). `confirmDeclareBlocks` blocks values are `CardId[] | "pass"`. If any attack has 2+ blockers, phase goes to `assign_damage_order` instead of `duel_attacker_turn`.

**Rule 3** — Spade/Club cancellation: Club cards are stored in `Royal.attachedCards` (not immediately sent to abyss). `checkAndApplyCancellation` in attachments.ts fires after any attach and cancels matching pip totals. Tests: Club in attachedCards after apply, NOT in abyss unless Royal dies.

**Rule 4** — Jokers allowed in respond_to_club window: `canPlayCard` validation.ts allowlist includes Jokers.

**Rule 5** — Attacker stays tapped until controller's NEXT turn: `healAllRoyals` does NOT reset `hasAttackedThisTurn`; `advanceTurn` resets it for the NEXT player's Royals before draw.

**Rule 6** — No life loss when Royal dies from Club: `confirmClubResponse` in clubs.ts skips the life penalty.

**Interrupt Clubs stage the respond window** — a Club played as an interrupt (opponent's turn/phase) stages `respond_to_club` with `pendingClubDebuff.returnPhase` = the interrupted phase, so the Royal's owner can react before the debuff lands. Exception: an interrupt Club while a respond window is already open resolves immediately and restores the pending payload. `confirmClubResponse` only marks the duel pair resolved when the Club's attacker is a duel participant — third-party interrupts never end the duel.

**Why:** Original spec required these six mechanics changes simultaneously.
**How to apply:** Any future test involving declareAttack must pass royalCardIds[]. Any test about Club cards: they live in attachedCards until Royal is destroyed.
