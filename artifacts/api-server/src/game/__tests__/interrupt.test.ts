import { describe, it, expect } from "vitest";
import { dispatchAction } from "../dispatcher";
import { makeState, makePlayer, P1, P2 } from "./helpers";
import type { RoyalInCourt } from "../types";

const P3 = "player-3";

function mkRoyal(cardId: string, overrides: Partial<RoyalInCourt> = {}): RoyalInCourt {
  return {
    cardId,
    hasAttackedThisTurn: false,
    hasteLocked: false,
    damageTaken: 0,
    buffAttack: 0,
    buffHealth: 0,
    attachedCards: [],
    ...overrides,
  };
}

describe("opponent-turn interrupt (immediate resolution)", () => {
  it("resolves a non-active player's interrupt immediately and returns to the original phase", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      deck: ["4S", "5S"],
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { hand: ["2D"] }),
      },
    });

    const result = dispatchAction(state, P2, { type: "discard_diamond_to_draw", cardId: "2D" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // No interrupt window is ever exposed — the play resolves and the game
    // returns to exactly the phase it was in.
    expect(result.value.phase).toBe("main");
    expect(result.value.interruptStack).toBeUndefined();
    // The Diamond was actually discarded (resolved) and a card drawn.
    expect(result.value.players[P2]!.hand).not.toContain("2D");
    expect(result.value.players[P2]!.hand).toContain("4S");
  });

  it("executes the active player's own eligible actions directly (never as an interrupt)", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      deck: ["4S"],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"] }),
        [P2]: makePlayer(P2),
      },
    });

    const result = dispatchAction(state, P1, { type: "discard_diamond_to_draw", cardId: "2D" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).not.toBe("interrupt_window");
    expect(result.value.interruptStack).toBeUndefined();
    expect(result.value.players[P1]!.hand).not.toContain("2D");
  });

  it("rejects Royals, attacks, and Diamond-to-Mine as interrupts", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { hand: ["KH", "5D"] }),
      },
    });

    const royalResult = dispatchAction(state, P2, { type: "play_royal_to_court", cardId: "KH" });
    expect(royalResult.ok).toBe(false);

    const diamondToMineResult = dispatchAction(state, P2, { type: "play_diamond_to_mine", cardId: "5D" });
    expect(diamondToMineResult.ok).toBe(false);

    const attackResult = dispatchAction(state, P2, { type: "declare_attack", targets: [{ targetPlayerId: P1, royalCardIds: ["KH"] }] });
    expect(attackResult.ok).toBe(false);
  });

  it("enforces the vault cost for an interrupt just like a normal play", () => {
    // Mine yields only 1 vault, but the Spade costs its pip value (5), so the
    // interrupting player cannot afford it and the play is rejected.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["AD"],
      abyss: ["3H"],
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { hand: ["5S"] }),
      },
    });

    const result = dispatchAction(state, P2, {
      type: "discard_spade_to_return",
      spadeCardId: "5S",
      targetCardId: "3H",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/vault/i);
  });

  it("lets a third, uninvolved player interrupt during declare_blocks and resolves immediately", () => {
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      deck: ["9S", "9C"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
        [P3]: makePlayer(P3, { hand: ["2D"] }),
      },
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
        } as any,
      ],
    });

    const result = dispatchAction(state, P3, { type: "discard_diamond_to_draw", cardId: "2D" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Resolves immediately and returns to the blocking step.
    expect(result.value.phase).toBe("declare_blocks");
    expect(result.value.interruptStack).toBeUndefined();
    expect(result.value.players[P3]!.hand).not.toContain("2D");
  });

  it("interrupt_pass is rejected — there is no window to pass on", () => {
    const state = makeState({ phase: "main" });
    const result = dispatchAction(state, P1, { type: "interrupt_pass" });
    expect(result.ok).toBe(false);
  });

  it("rejects an interrupt whose action is invalid up-front rather than applying a partial effect", () => {
    // P2 can afford the Spade (Mine gives 6 vault) so the vault check passes,
    // but the target card is not in the Abyss, so the action itself is invalid.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["6D"],
      abyss: [],
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { hand: ["5S"] }),
      },
    });

    const result = dispatchAction(state, P2, {
      type: "discard_spade_to_return",
      spadeCardId: "5S",
      targetCardId: "3H",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The card was never removed from hand.
    expect(state.players[P2]!.hand).toContain("5S");
  });

  it("allows an interrupt Club to target any Royal during a duel and resolves immediately", () => {
    // A duel is in progress: P1's KH is blocked by P2's KS (an active pair).
    // P2's QS is a Royal that is NOT part of any duel pair.
    const base = makeState({
      phase: "duel_attacker_turn",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      mine: ["2D"],
      players: {
        // P1 keeps a playable duel card (2H) so the duel does not auto-resolve
        // after the club response completes.
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")], hand: ["2H"] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KS"), mkRoyal("QS")] }),
        [P3]: makePlayer(P3, { hand: ["2C"] }),
      },
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["KS"],
        } as any,
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
    });

    // Targeting QS (not in an active pair) is allowed — any Royal is
    // targetable during a duel under the multi-opponent combat rules.
    const benchTarget = dispatchAction(base, P3, {
      type: "apply_club",
      clubCardId: "2C",
      targetPlayerId: P2,
      targetRoyalId: "QS",
    });
    expect(benchTarget.ok).toBe(true);

    // Targeting KS (part of the active duel pair) is also allowed. The Club
    // stages a respond_to_club window so the Royal's owner (P2) can react
    // before the debuff lands; the interrupted duel phase is preserved as the
    // returnPhase.
    const goodTarget = dispatchAction(base, P3, {
      type: "apply_club",
      clubCardId: "2C",
      targetPlayerId: P2,
      targetRoyalId: "KS",
    });
    expect(goodTarget.ok).toBe(true);
    if (!goodTarget.ok) return;
    expect(goodTarget.value.phase).toBe("respond_to_club");
    expect(goodTarget.value.interruptStack).toBeUndefined();
    expect(goodTarget.value.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P3,
      clubCardId: "2C",
      targetPlayerId: P2,
      targetRoyalId: "KS",
      returnPhase: "duel_attacker_turn",
    });
    // The Club was spent from the interrupter's hand when staged.
    expect(goodTarget.value.players[P3]!.hand).not.toContain("2C");

    // The Royal's owner confirms: the debuff lands and play returns to the duel.
    const confirmed = dispatchAction(goodTarget.value, P2, { type: "confirm_club_response" });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.phase).toBe("duel_attacker_turn");
    expect(confirmed.value.pendingClubDebuff).toBeUndefined();
    expect(confirmed.value.players[P2]!.court.find((r) => r.cardId === "KS")!.buffHealth).toBe(-2);
  });

  it("stages a respond_to_club window when a Club interrupts an opponent's main phase", () => {
    // P1 is taking their main phase with a buffed KH in court. P2 interrupts
    // with a Club targeting KH: P1 must get the respond window before the
    // debuff lands, and confirming returns the game to P1's main phase.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["2D"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["2C"] }),
      },
    });

    const result = dispatchAction(state, P2, {
      type: "apply_club",
      clubCardId: "2C",
      targetPlayerId: P1,
      targetRoyalId: "KH",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("respond_to_club");
    expect(result.value.interruptStack).toBeUndefined();
    expect(result.value.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P2,
      clubCardId: "2C",
      targetPlayerId: P1,
      targetRoyalId: "KH",
      returnPhase: "main",
    });
    expect(result.value.players[P2]!.hand).not.toContain("2C");

    // The Royal's owner confirms: the debuff lands and play returns to main.
    const confirmed = dispatchAction(result.value, P1, { type: "confirm_club_response" });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.phase).toBe("main");
    expect(confirmed.value.activePlayerId).toBe(P1);
    expect(confirmed.value.pendingClubDebuff).toBeUndefined();
    expect(confirmed.value.players[P1]!.court.find((r) => r.cardId === "KH")!.buffHealth).toBe(-2);
  });

  it("does not let a duel participant take a second Diamond action on their own duel turn", () => {
    // P1 (duel attacker) already spent their duel Diamond. As the turn holder
    // they act directly; the duel limit blocks a second Diamond.
    const base = makeState({
      phase: "duel_attacker_turn",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D", "3D"] }),
        [P2]: makePlayer(P2, {}),
        [P3]: makePlayer(P3, {}),
      },
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: true,
        defenderDiamondUsed: false,
      },
    });

    const onDuelTurn = dispatchAction(base, P1, { type: "discard_diamond_to_draw", cardId: "2D" });
    expect(onDuelTurn.ok).toBe(false);
  });

  it("resolves an interrupt Club during respond_to_club while preserving the pending Club response", () => {
    // P1 has played a Club against P2's KS, so the game sits in respond_to_club
    // with P2 as the responder. Before P2 confirms, bystander P3 interrupts with
    // their own Club against P1's KH. It resolves immediately and the game must
    // return to respond_to_club with the ORIGINAL pendingClubDebuff intact so
    // confirm_club_response stays actionable. (Kings survive the small-pip
    // debuffs so we can assert on their state.)
    let state = makeState({
      phase: "respond_to_club",
      activePlayerId: P1,
      turnOrder: [P1, P2, P3],
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KS")] }),
        [P3]: makePlayer(P3, { hand: ["2C"] }),
      },
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "AC",
        targetPlayerId: P2,
        targetRoyalId: "KS",
        defenderDiamondUsed: false,
      },
    });

    // P3 (not the responder) plays a Club → resolves immediately as an interrupt.
    const result = dispatchAction(state, P3, {
      type: "apply_club",
      clubCardId: "2C",
      targetPlayerId: P1,
      targetRoyalId: "KH",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.value;

    // Back in respond_to_club with the ORIGINAL pending debuff still present.
    expect(state.phase).toBe("respond_to_club");
    expect(state.interruptStack).toBeUndefined();
    expect(state.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P1,
      clubCardId: "AC",
      targetPlayerId: P2,
      targetRoyalId: "KS",
    });
    // The interrupt Club actually resolved against P1's KH (debuffed by pip 2).
    expect(state.players[P3]!.hand).not.toContain("2C");
    expect(state.players[P1]!.court.find((r) => r.cardId === "KH")!.buffHealth).toBe(-2);

    // And the defender can still confirm the original Club response.
    const confirm = dispatchAction(state, P2, { type: "confirm_club_response" });
    expect(confirm.ok).toBe(true);
    if (!confirm.ok) return;
    expect(confirm.value.pendingClubDebuff).toBeUndefined();
    // The original Ace-of-Clubs debuff (pip 1) lands on KS.
    expect(confirm.value.players[P2]!.court.find((r) => r.cardId === "KS")!.buffHealth).toBe(-1);
  });
});
