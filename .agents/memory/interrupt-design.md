---
name: Interrupt design — immediate resolution
description: How opponent-turn interrupts resolve; why there is no priority stack.
---

# Opponent-turn interrupts resolve IMMEDIATELY (no stack, no priority pass)

A non-active, non-eliminated player may play an eligible card (no Royals, no
attacks, no Diamond-to-Mine) during any other player's turn/phase. The card
takes effect right away and play returns to exactly the phase it was in. There
is no LIFO stack and no priority passing.

**Exception (user-reported bug fix):** a Club played as an interrupt does NOT
resolve silently — it stages the standard `respond_to_club` window so the
targeted Royal's owner can react before the debuff lands.
`pendingClubDebuff.returnPhase` carries the interrupted phase; confirming
returns there. If a respond window is already open, an interrupt Club resolves
immediately and restores the pending payload. A third-party interrupt Club
during a duel never resolves the duel pair — only duel participants' Clubs do
(see combat-rules.md).

**Why:** An earlier MTG-style LIFO interrupt stack (with priority passing where
every player, including the interrupter, had to pass before the top resolved)
was rejected by the user as confusing. The user explicitly chose "resolve
immediately — no one can respond": the player interrupts, their play happens,
and the game moves on. Prefer this model; do not reintroduce a priority stack
unless the user asks.

**How to apply:**
- The `interrupt_window` phase is a transient probe context only — it is NEVER
  persisted in game state or sent to clients. A non-turn-holder's eligible
  action is resolved inside that transient context (so vault-cost / no-Royals
  checks in `canPlayCard`, duel-target restrictions via `effectiveDuelPhase`,
  and the club interrupt branch still apply), then the original phase is
  restored and the interrupt state cleared.
- Because clients never see `interrupt_window`, any UI gated on that phase (a
  priority banner / "Pass Priority" button) is dead and never renders. The path
  that actually lets a bystander play during an opponent's turn is the
  initiate-interrupt helper on the client (validates the card, submits the
  action, server resolves immediately).
- A pass action is rejected — there is no window to pass on. The action type may
  remain defined in the schema for compatibility.
- Original-rule preservation is a hard requirement: vault cost is enforced for
  interrupts, and the active player always plays normally (their actions execute
  directly, never routed through the interrupt path).
