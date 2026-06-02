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
    const result = declareAttack(state, P1, P2, ["KH", "QS"]);
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
    const result = declareAttack(state, P1, P2, ["KH"]);
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
    const result = declareAttack(state, P1, P2, ["KH", "QS"]);
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
    const result = declareAttack(state, P1, P2, []);
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
    const result = declareAttack(state, P1, P2, ["KH"]);
    expect(result.ok).toBe(false);
  });

  it("rejects attacking yourself", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, P1, ["KH"]);
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
    const result = declareAttack(state, P1, P2, ["KH"]);
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
    const result = declareAttack(state, P1, P2, ["KH"]);
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
    const result = declareAttack(state, P1, P2, ["KH", "KH"]);
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

    const afterAttack = declareAttack(initial, P1, P2, ["KH", "QS"]);
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
});
