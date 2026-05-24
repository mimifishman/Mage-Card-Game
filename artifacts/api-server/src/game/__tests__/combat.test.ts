import { describe, it, expect } from "vitest";
import { declareAttack, confirmDeclareBlocks, duelPass, resolveCombat } from "../combat";
import { discardToAbyss, discardDiamondToDraw, discardDiamondForBoost } from "../diamonds";
import { makeState, makePlayer, P1, P2 } from "./helpers";
import type { RoyalInCourt } from "../types";

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

describe("declareAttack (multi-Royal)", () => {
  it("sends all eligible Royals into attack and transitions to declare_blocks", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(2);
    expect(result.value.attacks.every((a) => a.targetPlayerId === P2)).toBe(true);
    expect(result.value.attacks.every((a) => a.attackerPlayerId === P1)).toBe(true);
    expect(result.value.phase).toBe("declare_blocks");
    expect(result.value.hasAttackedThisTurn).toBe(true);
    expect(result.value.players[P1]!.court.every((r) => r.hasAttackedThisTurn)).toBe(true);
  });

  it("excludes haste-locked Royals from the attack", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS", { hasteLocked: true })] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(1);
    expect(result.value.attacks[0]!.attackerCardId).toBe("KH");
  });

  it("rejects if no eligible Royals (all haste-locked)", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH", { hasteLocked: true })] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/eligible/i);
  });

  it("rejects if not active player's turn", () => {
    const state = makeState({
      activePlayerId: P2,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(false);
  });

  it("rejects attacking yourself", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P1);
    expect(result.ok).toBe(false);
  });

  it("rejects if already attacked this turn", () => {
    const state = makeState({
      hasAttackedThisTurn: true,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(false);
  });

  it("rejects if not in main phase", () => {
    const state = makeState({
      phase: "declare_blocks",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P2);
    expect(result.ok).toBe(false);
  });
});

describe("confirmDeclareBlocks", () => {
  it("assigns blockers and transitions to duel_attacker_turn", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JD")] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, {
      KH: "JD",
      QS: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("duel_attacker_turn");
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerCardId).toBe("JD");
    const qs = result.value.attacks.find((a) => a.attackerCardId === "QS");
    expect(qs?.passed).toBe(true);
    expect(result.value.duelContext).toBeDefined();
    expect(result.value.duelContext!.attackerPlayerId).toBe(P1);
    expect(result.value.duelContext!.defenderPlayerId).toBe(P2);
  });

  it("rejects if a blocker is used for multiple attacks", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, {
      KH: "JD",
      QS: "JD",
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already used/i);
  });

  it("rejects if missing block assignment for an attack", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, {
      KH: "JD",
    });
    expect(result.ok).toBe(false);
  });

  it("rejects if blocker not in court", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: "JD" });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not in your Court/i);
  });

  it("rejects if not in declare_blocks phase", () => {
    const state = makeState({
      phase: "main",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: "pass" });
    expect(result.ok).toBe(false);
  });
});

describe("duelPass", () => {
  function duelState() {
    return makeState({
      phase: "duel_attacker_turn",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], life: 20 }),
      },
    });
  }

  it("attacker passes — transitions to duel_blocker_turn", () => {
    const state = duelState();
    const result = duelPass(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("duel_blocker_turn");
    expect(result.value.duelContext!.duelAttackerPassed).toBe(true);
    expect(result.value.duelContext!.duelBlockerPassed).toBe(false);
  });

  it("both players pass back-to-back — auto-resolves combat", () => {
    const state = {
      ...duelState(),
      phase: "duel_blocker_turn" as const,
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: true,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
    };
    const result = duelPass(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.players[P2]!.life).toBe(17);
    expect(result.value.attacks).toHaveLength(0);
    expect(result.value.duelContext).toBeUndefined();
  });

  it("rejects pass if not the correct player's turn", () => {
    const state = duelState();
    const result = duelPass(state, P2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not your turn/i);
  });

  it("rejects pass outside duel phases", () => {
    const state = makeState({ phase: "main" });
    const result = duelPass(state, P1);
    expect(result.ok).toBe(false);
  });
});

describe("Diamond actions during duel (regular rules)", () => {
  function duelStateWithDiamond(hand: string[] = ["5D", "3H"]) {
    return makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand, court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["2D"], life: 20 }),
      },
    });
  }

  it("discard_diamond_to_draw: draws replacement cards and marks diamond used", () => {
    const state = duelStateWithDiamond();
    const handSizeBefore = state.players[P1]!.hand.length;
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand.length).toBeGreaterThanOrEqual(handSizeBefore);
    expect(result.value.duelContext!.attackerDiamondUsed).toBe(true);
  });

  it("discard_diamond_for_boost: discards Diamond, boosts vault, marks diamond used", () => {
    const state = duelStateWithDiamond();
    const result = discardDiamondForBoost(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.abyss).toContain("5D");
    expect(result.value.players[P1]!.hand).not.toContain("5D");
    expect(result.value.duelContext!.attackerDiamondUsed).toBe(true);
  });

  it("rejects discard_diamond_to_draw if diamond already used this duel", () => {
    const state = {
      ...duelStateWithDiamond(),
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: true,
        defenderDiamondUsed: false,
      },
    };
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already used/i);
  });

  it("rejects discard_diamond_for_boost if diamond already used this duel", () => {
    const state = {
      ...duelStateWithDiamond(),
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: true,
        defenderDiamondUsed: false,
      },
    };
    const result = discardDiamondForBoost(state, P1, "5D");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already used/i);
  });
});

describe("resolveCombat (from duel phases)", () => {
  it("resolves combat from duel phase — unblocked attack deals damage", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.players[P2]!.life).toBe(17);
    expect(result.value.attacks).toHaveLength(0);
    expect(result.value.duelContext).toBeUndefined();
  });

  it("blocked attack: both Royals take damage", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardId: "JD" }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20, court: [mkRoyal("JD")] }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(20);
    expect(result.value.abyss).toContain("JD");
    const kh = result.value.players[P1]!.court.find((r) => r.cardId === "KH");
    expect(kh?.damageTaken).toBe(1);
  });

  it("rejects if not called by active player", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P2);
    expect(result.ok).toBe(false);
  });

  it("rejects from main phase", () => {
    const state = makeState({
      phase: "main",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(false);
  });
});

describe("full duel flow: attack → blocks → duel → resolve", () => {
  it("full multi-Royal duel flow with one blocker and one unblocked", () => {
    const initial = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], life: 20, court: [mkRoyal("JD")] }),
      },
    });

    const afterAttack = declareAttack(initial, P1, P2);
    expect(afterAttack.ok).toBe(true);
    if (!afterAttack.ok) return;
    expect(afterAttack.value.phase).toBe("declare_blocks");
    expect(afterAttack.value.attacks).toHaveLength(2);

    const afterBlocks = confirmDeclareBlocks(afterAttack.value, P2, {
      KH: "JD",
      QS: "pass",
    });
    expect(afterBlocks.ok).toBe(true);
    if (!afterBlocks.ok) return;
    expect(afterBlocks.value.phase).toBe("duel_attacker_turn");

    const afterAttackerPass = duelPass(afterBlocks.value, P1);
    expect(afterAttackerPass.ok).toBe(true);
    if (!afterAttackerPass.ok) return;
    expect(afterAttackerPass.value.phase).toBe("duel_blocker_turn");

    const afterBothPass = duelPass(afterAttackerPass.value, P2);
    expect(afterBothPass.ok).toBe(true);
    if (!afterBothPass.ok) return;
    expect(afterBothPass.value.phase).toBe("main");
    expect(afterBothPass.value.players[P2]!.life).toBe(18);
    const jd = afterBothPass.value.players[P2]!.court.find((r) => r.cardId === "JD");
    expect(jd).toBeUndefined();
  });
});

describe("Diamond rule enforcement during duel", () => {
  function duelStateForDiamondTests() {
    return makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand: ["5D", "3H"], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["2D"], life: 20 }),
      },
    });
  }

  it("allows discard_diamond_to_draw during a duel phase (regular Diamond rules apply)", () => {
    const state = duelStateForDiamondTests();
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.duelContext!.attackerDiamondUsed).toBe(true);
  });

  it("allows discard_diamond_for_boost during a duel phase (regular Diamond rules apply)", () => {
    const state = duelStateForDiamondTests();
    const result = discardDiamondForBoost(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.duelContext!.attackerDiamondUsed).toBe(true);
  });

  it("allows discard_to_abyss with a Diamond card during a duel phase", () => {
    const state = duelStateForDiamondTests();
    const result = discardToAbyss(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.abyss).toContain("5D");
  });

  it("allows discard_to_abyss with a non-Diamond card during a duel phase", () => {
    const state = duelStateForDiamondTests();
    const result = discardToAbyss(state, P1, "3H");
    expect(result.ok).toBe(true);
  });

  it("auto-resolves duel when current player has only Royal cards in hand (no playable non-Royal)", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      mine: [],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand: ["QH"], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["JH"], life: 20 }),
      },
    });
    const result = duelPass(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.players[P2]!.life).toBe(17);
    expect(result.value.duelContext).toBeUndefined();
  });
});
