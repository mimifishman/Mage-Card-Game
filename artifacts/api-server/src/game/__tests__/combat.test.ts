import { describe, it, expect } from "vitest";
import { declareAttack, declareBlock, passBlock, resolveCombat } from "../combat";
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

describe("declareAttack", () => {
  it("declares attack and marks Royal as hasAttackedThisTurn", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareAttack(state, P1, "KH", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks).toHaveLength(1);
    expect(result.value.attacks[0]!.attackerCardId).toBe("KH");
    expect(result.value.players[P1]!.court[0]!.hasAttackedThisTurn).toBe(true);
    expect(result.value.phase).toBe("declare_attacks");
  });

  it("rejects haste-locked Royal", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH", { hasteLocked: true })] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, "KH", P2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/haste/i);
  });

  it("rejects Royal that already attacked", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { hasAttackedThisTurn: true })],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, "KH", P2);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already attacked/i);
  });

  it("rejects if not active player's turn", () => {
    const state = makeState({
      activePlayerId: P2,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, "KH", P2);
    expect(result.ok).toBe(false);
  });

  it("rejects attacking yourself", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, "KH", P1);
    expect(result.ok).toBe(false);
  });

  it("rejects multiple attacks from same Royal", () => {
    const state = makeState({
      phase: "declare_attacks",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
        },
      ],
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { hasAttackedThisTurn: true })],
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = declareAttack(state, P1, "KH", P2);
    expect(result.ok).toBe(false);
  });
});

describe("declareBlock", () => {
  it("assigns a blocker to an attack", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareBlock(state, P2, "QS", "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks[0]!.blockerCardId).toBe("QS");
  });

  it("rejects blocking when not in declare_blocks phase", () => {
    const state = makeState({
      phase: "main",
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareBlock(state, P2, "QS", "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if attack does not target defender", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareBlock(state, P1, "QS", "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if blocker already blocking", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 },
        { attackerPlayerId: P1, attackerCardId: "QH", targetPlayerId: P2, blockerCardId: "QS" },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareBlock(state, P2, "QS", "KH");
    expect(result.ok).toBe(false);
  });
});

describe("resolveCombat", () => {
  it("unblocked attack deals damage to target player (defender passed)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(16);
    expect(result.value.phase).toBe("end_turn");
    expect(result.value.attacks).toHaveLength(0);
  });

  it("rejects resolve_combat when called from declare_attacks phase", () => {
    const state = makeState({
      phase: "declare_attacks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/declare_blocks/);
  });

  it("blocked attack: both Royals take damage, weak Royal destroyed and sent to Abyss", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardId: "JD",
        },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, {
          life: 20,
          court: [mkRoyal("JD")],
        }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(20);
    const jd = result.value.players[P2]!.court.find((r) => r.cardId === "JD");
    expect(jd).toBeUndefined();
    expect(result.value.abyss).toContain("JD");
    const kh = result.value.players[P1]!.court.find((r) => r.cardId === "KH");
    expect(kh).toBeDefined();
    expect(kh!.damageTaken).toBe(2);
  });

  it("blocked attack: blocked Royals with attachments send all to Abyss when destroyed", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "KH",
          targetPlayerId: P2,
          blockerCardId: "JD",
        },
      ],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD", { attachedCards: ["3H", "2S"] })],
        }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.abyss).toContain("JD");
    expect(result.value.abyss).toContain("3H");
    expect(result.value.abyss).toContain("2S");
  });

  it("rejects resolve_combat if not called by active player", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P2);
    expect(result.ok).toBe(false);
  });

  it("rejects resolve_combat in declare_blocks if any attack is undecided", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(false);
  });

  it("allows resolve_combat in declare_blocks when all attacks are passed", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const result = resolveCombat(state, P1);
    expect(result.ok).toBe(true);
  });
});

describe("passBlock", () => {
  it("marks attack as passed", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2 }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = passBlock(state, P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.attacks[0]!.passed).toBe(true);
  });

  it("rejects pass if attack already has a blocker", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardId: "QS" }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = passBlock(state, P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects pass if attack already passed (double-pass)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = passBlock(state, P2, "KH");
    expect(result.ok).toBe(false);
  });
});

describe("block/pass exclusivity", () => {
  it("rejects declareBlock if attack already passed", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, passed: true }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = declareBlock(state, P2, "QS", "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already passed/);
  });

  it("rejects passBlock if attack already has a blocker (block-then-pass)", () => {
    const state = makeState({
      phase: "declare_blocks",
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardId: "QS" }],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [P2]: makePlayer(P2, { court: [mkRoyal("QS")] }),
      },
    });
    const result = passBlock(state, P2, "KH");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/already blocked/);
  });
});
