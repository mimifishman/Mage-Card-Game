---
name: Mage Card Game — targeting architecture
description: Two independent UI paths apply card actions with targets; both must be updated together when changing targeting rules.
---

The mobile match screen has two separate, independent ways to submit a targeted card action:
1. The `CardActionSheet` modal (tap a card → pick action → pick target player/Royal).
2. Direct-tap handlers in `match.tsx` (`handleOwnRoyalPress`, `handleOpponentRoyalPress`) that let a player tap a Royal directly on the board while a card is "selected" (no modal).

**Why:** These two paths duplicate the suit/target logic independently. A prior change that widened Club/Heart/Spade targeting to "any player" only touched the modal path at first — the direct-tap path (`handleOpponentRoyalPress`) still silently ignored Hearts/Spades on opponent Royals (it only handled Clubs/Jokers), so cross-player Heart/Spade attachment worked via the modal but not via direct court tap.

**How to apply:** Any future change to which suits/actions can target which players (self vs. opponent) must be applied in both `CardActionSheet.tsx` (`handlePlayerTarget`/`getValidActionsForCard` in `gameUtils.ts`) AND the direct-tap handlers in `match.tsx` (`handleOwnRoyalPress` / `handleOpponentRoyalPress`). Grep for `handleOpponentRoyalPress`/`handleOwnRoyalPress` to find the second path before declaring a targeting change complete.

**Duel targeting is unrestricted server-side:** During duel phases any Royal may be targeted by Hearts/Spades/Clubs/Jokers — "active duel pair only" and "unblocked attacker" gates were deliberately removed at the user's request. Duel-pair membership is a UI highlight concern only (gold border + "⚔ DUEL" badge), not a validation rule. A Club on a Royal in the active pair still resolves that pair; a Club on any other Royal is a plain debuff (markDuelPairResolved safely no-ops for non-pair Royals). Do not re-add pair-based targeting gates.

There is also a third place that must be checked: `match.tsx`'s `handleAction` builds the request body per-action in a big switch statement, and it's easy to widen a UI target picker (add self/opponent options) without adding the corresponding `targetPlayerId` field to that action's request body — the server then silently falls back to its own default (usually self), so the picked target is dropped with no error. When adding a new targetable field to an action, verify all three: the picker UI, the request-body switch in `handleAction`, and the server schema/handler.
