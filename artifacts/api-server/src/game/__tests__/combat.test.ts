import { describe, it, expect } from "vitest";
import { declareAttack, confirmDeclareBlocks, setDamageOrder, duelPass, resolveCombat, autoAdvanceDuelIfNeeded } from "../combat";
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

describe("declareAttack (multi-Royal, Rule 1)", () => {
  it("attacks with specified royal IDs and transitions to declare_blocks", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH", "QS"] }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(2);
    expect(result.value.attacks.every((a) => a.targetPlayerId === P2)).toBe(true);
    expect(result.value.attacks.every((a) => a.attackerPlayerId === P1)).toBe(true);
    expect(result.value.phase).toBe("declare_blocks");
    expect(result.value.hasAttackedThisTurn).toBe(true);
    expect(result.value.players[P1]!.court.every((r) => r.hasAttackedThisTurn)).toBe(true);
  });

  it("attacks with only a subset of eligible royals", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH"] }]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(1);
    expect(result.value.attacks[0]!.attackerCardId).toBe("KH");
    const qs = result.value.players[P1]!.court.find((r) => r.cardId === "QS");
    expect(qs?.hasAttackedThisTurn).toBe(false);
  });

  it("rejects if a specified royal is haste-locked", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS", { hasteLocked: true })] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH", "QS"] }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/haste-locked/i);
  });

  it("rejects an empty royalCardIds list", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: [] }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/at least one/i);
  });

  it("rejects if not active player's turn", () => {
    const state = makeState({
      activePlayerId: P2,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH"] }]);
    expect(result.ok).toBe(false);
  });

  it("rejects attacking yourself", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P1, royalCardIds: ["KH"] }]);
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
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH"] }]);
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
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH"] }]);
    expect(result.ok).toBe(false);
  });

  it("rejects duplicate Royal IDs in the attack list", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, [{ targetPlayerId: P2, royalCardIds: ["KH", "KH"] }]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/duplicate/i);
  });
});

describe("confirmDeclareBlocks (Rule 2 — multi-blocker)", () => {
  it("assigns single blocker array and transitions to duel_blocker_turn (blocker acts first)", () => {
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
      KH: ["JD"],
      QS: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("duel_blocker_turn");
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerCardIds).toEqual(["JD"]);
    const qs = result.value.attacks.find((a) => a.attackerCardId === "QS");
    expect(qs?.passed).toBe(true);
    expect(result.value.duelContext).toBeDefined();
    expect(result.value.duelContext!.attackerPlayerId).toBe(P1);
    expect(result.value.duelContext!.defenderPlayerId).toBe(P2);
  });

  it("multi-blocker on one attacker transitions to assign_damage_order (Rule 2)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD"), mkRoyal("QS")] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JD", "QS"],
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("assign_damage_order");
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerCardIds).toEqual(["JD", "QS"]);
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
      KH: ["JD"],
      QS: ["JD"],
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
      KH: ["JD"],
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
    const result = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/not in your Court/i);
  });

  it("rejects a tapped Royal as blocker (Rule 5)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD", { hasAttackedThisTurn: true })] }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already attacked/i);
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

  it("blocked attack: both Royals take damage (single blocker in array)", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] }],
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

    const afterAttack = declareAttack(initial, P1, [{ targetPlayerId: P2, royalCardIds: ["KH", "QS"] }]);
    expect(afterAttack.ok).toBe(true);
    if (!afterAttack.ok) return;
    expect(afterAttack.value.phase).toBe("declare_blocks");
    expect(afterAttack.value.attacks).toHaveLength(2);

    const afterBlocks = confirmDeclareBlocks(afterAttack.value, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(afterBlocks.ok).toBe(true);
    if (!afterBlocks.ok) return;
    expect(afterBlocks.value.phase).toBe("duel_blocker_turn");

    const afterBlockerPass = duelPass(afterBlocks.value, P2);
    expect(afterBlockerPass.ok).toBe(true);
    if (!afterBlockerPass.ok) return;
    expect(afterBlockerPass.value.phase).toBe("duel_attacker_turn");

    const afterBothPass = duelPass(afterBlockerPass.value, P1);
    expect(afterBothPass.ok).toBe(true);
    if (!afterBothPass.ok) return;
    expect(afterBothPass.value.phase).toBe("main");
    expect(afterBothPass.value.players[P2]!.life).toBe(18);
    const jd = afterBothPass.value.players[P2]!.court.find((r) => r.cardId === "JD");
    expect(jd).toBeUndefined();
  });
});

describe("mutual kill: both Royals die on equal duel damage", () => {
  it("removes both attacker and blocker when they deal exactly equal damage (King vs King)", () => {
    // KH (3 ATK, 3 HP) attacks; KS (3 ATK, 3 HP) blocks — each kills the other simultaneously.
    const state = makeState({
      phase: "duel_blocker_turn",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["KS"],
        },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: true,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20, court: [mkRoyal("KS")] }),
      },
    });

    const result = duelPass(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.phase).toBe("main");

    // Both Royals must be gone from their respective courts.
    expect(result.value.players[P1]!.court.find((r) => r.cardId === "KH")).toBeUndefined();
    expect(result.value.players[P2]!.court.find((r) => r.cardId === "KS")).toBeUndefined();

    // Both must be in the abyss.
    expect(result.value.abyss).toContain("KH");
    expect(result.value.abyss).toContain("KS");

    // No direct player life loss — the attack was fully blocked.
    expect(result.value.players[P2]!.life).toBe(20);
  });

  it("removes both attacker and blocker when they deal equal damage (Queen vs Queen)", () => {
    // QH (2 ATK, 2 HP) attacks; QD (2 ATK, 2 HP) blocks — symmetrical kill.
    const state = makeState({
      phase: "duel_blocker_turn",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "QH",
          targetPlayerId: P2,
          blockerCardIds: ["QD"],
        },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: true,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH")] }),
        [P2]: makePlayer(P2, { life: 20, court: [mkRoyal("QD")] }),
      },
    });

    const result = duelPass(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.value.players[P1]!.court.find((r) => r.cardId === "QH")).toBeUndefined();
    expect(result.value.players[P2]!.court.find((r) => r.cardId === "QD")).toBeUndefined();
    expect(result.value.abyss).toContain("QH");
    expect(result.value.abyss).toContain("QD");
    expect(result.value.players[P2]!.life).toBe(20);
  });

  it("combat summary reports both destroyed on equal damage", () => {
    // Verify lastCombatSummary correctly flags both sides as destroyed.
    const state = makeState({
      phase: "duel_blocker_turn",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["KS"],
        },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: true,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20, court: [mkRoyal("KS")] }),
      },
    });

    const result = duelPass(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const summary = result.value.lastCombatSummary;
    expect(summary).toBeDefined();
    const pair = summary!.pairs.find((p) => p.attackerCardId === "KH");
    expect(pair).toBeDefined();
    expect(pair!.attackerDestroyed).toBe(true);
    expect(pair!.blockerDestroyed).toBe(true);
  });

  it("unequal duel: stronger attacker survives, weaker blocker is destroyed", () => {
    // KH (3 ATK, 3 HP) vs JD (1 ATK, 1 HP): KH takes 1 damage but survives; JD is destroyed.
    const state = makeState({
      phase: "duel_blocker_turn",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["JD"],
        },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: true,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20, court: [mkRoyal("JD")] }),
      },
    });

    const result = duelPass(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // KH survives with damage taken.
    const kh = result.value.players[P1]!.court.find((r) => r.cardId === "KH");
    expect(kh).toBeDefined();
    expect(kh!.damageTaken).toBe(1);

    // JD is destroyed.
    expect(result.value.players[P2]!.court.find((r) => r.cardId === "JD")).toBeUndefined();
    expect(result.value.abyss).toContain("JD");
    expect(result.value.abyss).not.toContain("KH");
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

  it("auto-resolves attacker turn when attacker has non-Royal cards but insufficient vault to play any of them", () => {
    // Attacker has a 6H but vault=0: every duel action (attach, heal, discard_to_abyss)
    // goes through canPlayCard which requires vault >= vaultCost(6). With no vault the
    // attacker is genuinely stuck → autoAdvanceDuelIfNeeded should auto-pass and resolve.
    const state = makeState({
      phase: "duel_attacker_turn",
      mine: [],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["QS"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: true,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: ["6H"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("QS")],
          life: 20,
        }),
      },
    });

    const result = autoAdvanceDuelIfNeeded(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.duelContext).toBeUndefined();
  });
});

describe("unblocked damage at duel start (mixed blocked/unblocked)", () => {
  function mixedAttackState() {
    return makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JD")], life: 20 }),
      },
    });
  }

  it("applies direct damage for unblocked (passed) attacks immediately when duel phase starts", () => {
    const state = mixedAttackState();
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // QS is Queen of Spades → attack = 2; P2 life should drop from 20 to 18 immediately
    expect(result.value.players[P2]!.life).toBe(18);
    // KH is still in a duel pair — no immediate damage applied for it
    expect(result.value.phase).toBe("duel_blocker_turn");
  });

  it("records preResolvedUnblockedAttackerIds in duelContext for skipping at resolution", () => {
    const state = mixedAttackState();
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.duelContext!.preResolvedUnblockedAttackerIds).toContain("QS");
    expect(result.value.duelContext!.preResolvedUnblockedAttackerIds).not.toContain("KH");
  });

  it("records immediateHits in duelContext for the combat log", () => {
    const state = mixedAttackState();
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const hits = result.value.duelContext!.immediateHits ?? [];
    expect(hits).toHaveLength(1);
    expect(hits[0]!.attackerCardId).toBe("QS");
    expect(hits[0]!.directDamage).toBe(2);
    expect(hits[0]!.targetPlayerId).toBe(P2);
  });

  it("does not double-count unblocked damage when duel resolves at end", () => {
    const state = mixedAttackState();
    // Confirm blocks: KH blocked by JD, QS unblocked
    const afterBlocks = confirmDeclareBlocks(state, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(afterBlocks.ok).toBe(true);
    if (!afterBlocks.ok) return;

    // P2 already took 2 damage from QS immediately
    expect(afterBlocks.value.players[P2]!.life).toBe(18);

    // Both players pass the duel (no cards to play)
    const afterP2Pass = duelPass(afterBlocks.value, P2);
    expect(afterP2Pass.ok).toBe(true);
    if (!afterP2Pass.ok) return;

    const afterP1Pass = duelPass(afterP2Pass.value, P1);
    expect(afterP1Pass.ok).toBe(true);
    if (!afterP1Pass.ok) return;

    // After resolution: KH (attack=3) vs JD (attack=1, health=1) — KH kills JD
    // P2's life should only reflect the KH→JD duel result (no player life loss from a blocked pair)
    // QS damage (2) was already applied; total P2 life = 18 (no further life loss since KH is blocked)
    expect(afterP1Pass.value.phase).toBe("main");
    expect(afterP1Pass.value.players[P2]!.life).toBe(18);
  });

  it("combat summary includes immediateHits from pre-resolved unblocked attacks", () => {
    const state = mixedAttackState();
    const afterBlocks = confirmDeclareBlocks(state, P2, {
      KH: ["JD"],
      QS: "pass",
    });
    expect(afterBlocks.ok).toBe(true);
    if (!afterBlocks.ok) return;

    const afterP2Pass = duelPass(afterBlocks.value, P2);
    expect(afterP2Pass.ok).toBe(true);
    if (!afterP2Pass.ok) return;

    const afterP1Pass = duelPass(afterP2Pass.value, P1);
    expect(afterP1Pass.ok).toBe(true);
    if (!afterP1Pass.ok) return;

    const summary = afterP1Pass.value.lastCombatSummary;
    expect(summary).toBeDefined();
    expect(summary!.immediateHits).toBeDefined();
    expect(summary!.immediateHits).toHaveLength(1);
    expect(summary!.immediateHits![0]!.attackerCardId).toBe("QS");
    expect(summary!.immediateHits![0]!.directDamage).toBe(2);
  });

  it("all-unblocked attacks skip duel entirely — existing behavior unchanged", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [], life: 20 }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: "pass" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // When all attacks are unblocked, duel auto-advances and resolves immediately
    // Life is already reduced by 3 (KH attack) at duel entry
    expect(result.value.players[P2]!.life).toBe(17);
    expect(result.value.phase).toBe("main");
  });

  it("applies immediate damage for multiple unblocked Royals in a mixed scenario", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "JD", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS"), mkRoyal("JD")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JS")], life: 20 }),
      },
    });
    // JS blocks KH, QS and JD are unblocked
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JS"],
      QS: "pass",
      JD: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // QS=2, JD=1 → 3 immediate damage, 20-3=17
    expect(result.value.players[P2]!.life).toBe(17);
    const preResolved = result.value.duelContext!.preResolvedUnblockedAttackerIds ?? [];
    expect(preResolved).toContain("QS");
    expect(preResolved).toContain("JD");
    expect(preResolved).not.toContain("KH");
    const hits = result.value.duelContext!.immediateHits ?? [];
    expect(hits).toHaveLength(2);
  });

  it("unblocked damage applied at duel start even when assign_damage_order phase is triggered (multi-blocker)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD"), mkRoyal("JS")], life: 20 }),
      },
    });
    // KH is multi-blocked (JD + JS), QH is unblocked
    const result = confirmDeclareBlocks(state, P2, {
      KH: ["JD", "JS"],
      QH: "pass",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Should be in assign_damage_order phase (multi-blocker)
    expect(result.value.phase).toBe("assign_damage_order");
    // QH (attack=2) deals immediate damage → 20-2=18
    expect(result.value.players[P2]!.life).toBe(18);
    expect(result.value.duelContext!.preResolvedUnblockedAttackerIds).toContain("QH");
  });
});

const P3 = "player-3";

describe("declareAttack — multi-opponent targeting", () => {
  function threePlayerState(overrides: Partial<ReturnType<typeof makeState>> = {}) {
    return makeState({
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
        [P3]: makePlayer(P3, { court: [mkRoyal("JS")] }),
      },
      ...overrides,
    });
  }

  it("assigns different Royals to different opponents in a single action", () => {
    const state = threePlayerState();
    const result = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["QS"] },
    ]);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(2);
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    const qs = result.value.attacks.find((a) => a.attackerCardId === "QS");
    expect(kh?.targetPlayerId).toBe(P2);
    expect(qs?.targetPlayerId).toBe(P3);
    expect(result.value.phase).toBe("declare_blocks");
    expect(result.value.pendingBlockDefenders).toEqual(expect.arrayContaining([P2, P3]));
  });

  it("rejects reusing the same Royal across two target groups", () => {
    const state = threePlayerState();
    const result = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["KH"] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/duplicate/i);
  });

  it("rejects duplicate target groups for the same opponent", () => {
    const state = threePlayerState();
    const result = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P2, royalCardIds: ["QS"] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/same opponent/i);
  });

  it("rejects attacking an eliminated opponent", () => {
    const state = threePlayerState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")] }),
        [P3]: makePlayer(P3, { court: [mkRoyal("JS")], isEliminated: true }),
      },
    });
    const result = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["QS"] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/eliminated/i);
  });

  it("rejects self-targeting within a multi-target attack", () => {
    const state = threePlayerState();
    const result = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P1, royalCardIds: ["QS"] },
    ]);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/attack yourself/i);
  });
});

describe("confirmDeclareBlocks — parallel multi-opponent blocking", () => {
  function declaredMultiAttackState() {
    const state = makeState({
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")], life: 20 }),
        [P3]: makePlayer(P3, { court: [mkRoyal("JS")], life: 20 }),
      },
    });
    const declared = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["QS"] },
    ]);
    if (!declared.ok) throw new Error("setup failed");
    return declared.value;
  }

  it("does not begin combat resolution until every targeted opponent has submitted blocks", () => {
    const state = declaredMultiAttackState();
    const afterP2 = confirmDeclareBlocks(state, P2, { KH: "pass" });
    expect(afterP2.ok).toBe(true);
    if (!afterP2.ok) return;
    // Still waiting on P3 — should still be in declare_blocks, no life changes yet
    expect(afterP2.value.phase).toBe("declare_blocks");
    expect(afterP2.value.pendingBlockDefenders).toEqual([P3]);
    expect(afterP2.value.players[P2]!.life).toBe(20);
  });

  it("accepts opponents submitting blocks in any order and then resolves", () => {
    const state = declaredMultiAttackState();
    const afterP3 = confirmDeclareBlocks(state, P3, { QS: "pass" });
    expect(afterP3.ok).toBe(true);
    if (!afterP3.ok) return;
    expect(afterP3.value.phase).toBe("declare_blocks");
    expect(afterP3.value.pendingBlockDefenders).toEqual([P2]);

    const afterP2 = confirmDeclareBlocks(afterP3.value, P2, { KH: "pass" });
    expect(afterP2.ok).toBe(true);
    if (!afterP2.ok) return;
    // Both unblocked — combat resolves fully with immediate hits, no duel needed
    expect(afterP2.value.phase).toBe("main");
    expect(afterP2.value.players[P2]!.life).toBe(17); // KH direct damage
    expect(afterP2.value.players[P3]!.life).toBe(18); // QS direct damage
  });

  it("rejects a defender submitting blocks who wasn't targeted", () => {
    const state = declaredMultiAttackState();
    const result = confirmDeclareBlocks(state, P1, { KH: "pass" });
    expect(result.ok).toBe(false);
  });

  it("rejects a defender submitting blocks twice", () => {
    const state = declaredMultiAttackState();
    const afterP2 = confirmDeclareBlocks(state, P2, { KH: "pass" });
    expect(afterP2.ok).toBe(true);
    if (!afterP2.ok) return;
    const secondSubmit = confirmDeclareBlocks(afterP2.value, P2, { KH: "pass" });
    expect(secondSubmit.ok).toBe(false);
  });
});

describe("sequential duel queue — multi-opponent combat resolution", () => {
  function bothBlockedState() {
    const state = makeState({
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JD")], life: 20 }),
        [P3]: makePlayer(P3, { hand: ["4D"], court: [mkRoyal("JS")], life: 20 }),
      },
    });
    const declared = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["QS"] },
    ]);
    if (!declared.ok) throw new Error("setup failed");
    return declared.value;
  }

  it("enters a duel with the first targeted opponent (in declared order) when both block", () => {
    const state = bothBlockedState();
    const afterP2 = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    expect(afterP2.ok).toBe(true);
    if (!afterP2.ok) return;
    const afterP3 = confirmDeclareBlocks(afterP2.value, P3, { QS: ["JS"] });
    expect(afterP3.ok).toBe(true);
    if (!afterP3.ok) return;

    expect(afterP3.value.duelContext?.defenderPlayerId).toBe(P2);
    expect(afterP3.value.duelQueue).toEqual([P3]);
    expect(["duel_blocker_turn", "duel_attacker_turn"]).toContain(afterP3.value.phase);
  });

  it("advances the queue to the next opponent once the first opponent's fight resolves, and produces a combined summary", () => {
    const state = bothBlockedState();
    const afterP2 = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    if (!afterP2.ok) throw new Error("setup failed");
    const afterP3 = confirmDeclareBlocks(afterP2.value, P3, { QS: ["JS"] });
    if (!afterP3.ok) throw new Error("setup failed");

    // Resolve the first duel (P1 vs P2) via mutual pass — blocker (defender) acts first
    const p2PassFirst = duelPass(afterP3.value, P2);
    if (!p2PassFirst.ok) throw new Error(p2PassFirst.error);
    const bothPassFirst = duelPass(p2PassFirst.value, P1);
    expect(bothPassFirst.ok).toBe(true);
    if (!bothPassFirst.ok) return;

    // Should now have advanced into the duel against P3, not finalized yet
    expect(bothPassFirst.value.phase).not.toBe("main");
    expect(bothPassFirst.value.duelContext?.defenderPlayerId).toBe(P3);
    expect(bothPassFirst.value.duelQueue).toEqual([]);

    // Resolve the second duel (P1 vs P3) via mutual pass — blocker acts first
    const p3PassSecond = duelPass(bothPassFirst.value, P3);
    if (!p3PassSecond.ok) throw new Error(p3PassSecond.error);
    const finalState = duelPass(p3PassSecond.value, P1);
    expect(finalState.ok).toBe(true);
    if (!finalState.ok) return;

    expect(finalState.value.phase).toBe("main");
    expect(finalState.value.duelContext).toBeUndefined();
    expect(finalState.value.duelQueue).toBeUndefined();
    // Combined summary should include pairs from BOTH fights
    const pairs = finalState.value.lastCombatSummary?.pairs ?? [];
    expect(pairs.some((p) => p.attackerCardId === "KH")).toBe(true);
    expect(pairs.some((p) => p.attackerCardId === "QS")).toBe(true);
  });

  it("applies unblocked hits for one opponent while still fighting a blocked pair with another", () => {
    const state = makeState({
      turnOrder: [P1, P2, P3],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JD")], life: 20 }),
        [P3]: makePlayer(P3, { court: [], life: 20 }),
      },
    });
    const declared = declareAttack(state, P1, [
      { targetPlayerId: P2, royalCardIds: ["KH"] },
      { targetPlayerId: P3, royalCardIds: ["QS"] },
    ]);
    if (!declared.ok) throw new Error("setup failed");

    const afterP2 = confirmDeclareBlocks(declared.value, P2, { KH: ["JD"] });
    if (!afterP2.ok) throw new Error("setup failed");
    const afterP3 = confirmDeclareBlocks(afterP2.value, P3, { QS: "pass" });
    expect(afterP3.ok).toBe(true);
    if (!afterP3.ok) return;

    // P3 takes immediate unblocked damage from QS right away, before the KH/JD duel resolves
    expect(afterP3.value.players[P3]!.life).toBe(18);
    expect(afterP3.value.duelContext?.defenderPlayerId).toBe(P2);
    // Only P2 (blocked) enters the duel queue; P3 (fully unblocked) is skipped entirely
    expect(afterP3.value.duelQueue).toEqual([]);
  });

  it("single-target attacks are unaffected: no duel queue is created", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("JD")], life: 20 }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    // Blocks already assigned via `attacks` above; this call re-confirms with the same defender.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Single-target combat still resolves without leaving a multi-opponent duel queue.
    expect(result.value.duelQueue ?? []).toEqual([]);
  });
});

describe("setDamageOrder (Rule 2 validation)", () => {
  function multiBlockerState() {
    // Give both players non-Royal cards AND sufficient vault so
    // autoAdvanceDuelIfNeeded doesn't auto-resolve (mine provides vault=5).
    return makeState({
      phase: "assign_damage_order",
      mine: ["5D"],
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["JD", "QS"],
        },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["3H"], life: 20, court: [mkRoyal("JD"), mkRoyal("QS")] }),
      },
    });
  }

  it("accepts a valid permutation and advances to duel_blocker_turn (blocker acts first)", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P1, { KH: ["JD", "QS"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("duel_blocker_turn");
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerDamageOrder).toEqual(["JD", "QS"]);
  });

  it("accepts the reverse permutation", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P1, { KH: ["QS", "JD"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerDamageOrder).toEqual(["QS", "JD"]);
  });

  it("rejects if the provided list is missing a blocker", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P1, { KH: ["JD"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/invalid damage order/i);
  });

  it("rejects if the provided list contains an unknown blocker ID", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P1, { KH: ["JD", "ZZ"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/invalid damage order/i);
  });

  it("rejects if a required attacker assignment is missing from the payload", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P1, {});
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/missing damage order/i);
  });

  it("rejects if called by the defender (not the attacker)", () => {
    const state = multiBlockerState();
    const result = setDamageOrder(state, P2, { KH: ["JD", "QS"] });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/only the attacker/i);
  });

  it("rejects if called outside assign_damage_order phase", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2),
      },
    });
    const result = setDamageOrder(state, P1, {});
    expect(result.ok).toBe(false);
  });

  it("only requires a damage order for the currently active defender's multi-blocker attack, not other queued opponents", () => {
    // Multi-target attack: KH -> P2 (multi-blocked), QS -> P3 (multi-blocked, but
    // P3 is queued behind P2 and not the current duel's defender yet).
    const state = makeState({
      phase: "assign_damage_order",
      mine: ["5D"],
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardIds: ["JD", "QS_BLOCKER"],
        },
        {
          attackerPlayerId: P1,
          attackerCardId: "QS",
          targetPlayerId: P3,
          blockerCardIds: ["JD2", "QS2"],
        },
      ],
      duelQueue: [P3],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { hand: ["5H"], court: [mkRoyal("KH"), mkRoyal("QS")] }),
        [P2]: makePlayer(P2, { hand: ["3H"], life: 20, court: [mkRoyal("JD"), mkRoyal("QS_BLOCKER")] }),
        [P3]: makePlayer(P3, { hand: ["3H"], life: 20, court: [mkRoyal("JD2"), mkRoyal("QS2")] }),
      },
    });

    // Only providing the order for P2's fight (the active duel) should succeed
    // without needing to also supply an order for P3's still-queued fight.
    const result = setDamageOrder(state, P1, { KH: ["JD", "QS_BLOCKER"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("duel_blocker_turn");
    const kh = result.value.attacks.find((a) => a.attackerCardId === "KH");
    expect(kh?.blockerDamageOrder).toEqual(["JD", "QS_BLOCKER"]);
    const qs = result.value.attacks.find((a) => a.attackerCardId === "QS");
    expect(qs?.blockerDamageOrder).toBeUndefined();
  });
});

describe("autoResolved flag on lastCombatSummary", () => {
  it("sets autoResolved when both duelists have no playable cards (duel never shown)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: [], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: [], court: [mkRoyal("JD")], life: 20 }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Resolved instantly inside the block confirmation
    expect(result.value.phase).toBe("main");
    const summary = result.value.lastCombatSummary;
    expect(summary?.autoResolved).toBe(true);
    expect(summary?.autoPassedPlayerIds).toEqual(expect.arrayContaining([P1, P2]));
    // KH (atk 3) kills JD (hp 1); JD (atk 1) can't kill KH (hp 3)
    expect(result.value.players[P2]!.court.find((r) => r.cardId === "JD")).toBeUndefined();
  });

  it("does not set autoResolved when a duel phase was actually shown", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: ["2D"], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: ["3D"], court: [mkRoyal("JD")], life: 20 }),
      },
    });
    const afterBlocks = confirmDeclareBlocks(state, P2, { KH: ["JD"] });
    expect(afterBlocks.ok).toBe(true);
    if (!afterBlocks.ok) return;
    expect(afterBlocks.value.phase).toBe("duel_blocker_turn");

    const afterP2Pass = duelPass(afterBlocks.value, P2);
    expect(afterP2Pass.ok).toBe(true);
    if (!afterP2Pass.ok) return;
    const afterP1Pass = duelPass(afterP2Pass.value, P1);
    expect(afterP1Pass.ok).toBe(true);
    if (!afterP1Pass.ok) return;

    expect(afterP1Pass.value.phase).toBe("main");
    expect(afterP1Pass.value.lastCombatSummary?.autoResolved).toBeUndefined();
  });

  it("does not set autoResolved for a purely unblocked attack (no duel exists)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
      ],
      players: {
        [P1]: makePlayer(P1, { hand: [], court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { hand: [], court: [], life: 20 }),
      },
    });
    const result = confirmDeclareBlocks(state, P2, { KH: "pass" });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.lastCombatSummary?.autoResolved).toBeUndefined();
  });
});
