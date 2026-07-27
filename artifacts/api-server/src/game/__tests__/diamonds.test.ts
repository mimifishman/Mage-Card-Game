import { describe, it, expect } from "vitest";
import { playDiamondToMine, discardDiamondToDraw, discardDiamondForBoost } from "../diamonds";
import { calculateVaultFromMine } from "../vault";
import { makeState, makePlayer, P1, P2 } from "./helpers";

function stateWithHand(hand: string[], mine: string[] = [], deck: string[] = []) {
  return makeState({
    mine,
    players: {
      [P1]: makePlayer(P1, { hand, vault: { tempBoost: 0, spent: 0 } }),
      [P2]: makePlayer(P2),
    },
    deck,
  });
}

describe("playDiamondToMine", () => {
  it("moves Diamond from hand to shared mine", () => {
    const state = stateWithHand(["7D"]);
    const result = playDiamondToMine(state, P1, "7D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.mine).toContain("7D");
    expect(result.value.players[P1]!.hand).not.toContain("7D");
    expect(calculateVaultFromMine(result.value.mine)).toBe(7);
  });

  it("rejects non-Diamond cards", () => {
    const state = stateWithHand(["7H"]);
    const result = playDiamondToMine(state, P1, "7H");
    expect(result.ok).toBe(false);
  });

  it("rejects Royal Diamonds (J/Q/K)", () => {
    const state = stateWithHand(["JD"]);
    const result = playDiamondToMine(state, P1, "JD");
    expect(result.ok).toBe(false);
  });
});

describe("discardDiamondToDraw", () => {
  it("discards Diamond and draws a card", () => {
    const state = stateWithHand(["5D"], [], ["KH", "2C"]);
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).not.toContain("5D");
    expect(result.value.players[P1]!.hand).toContain("KH");
    expect(result.value.abyss).toContain("5D");
    expect(result.value.deck).toEqual(["2C"]);
  });

  it("rejects non-Diamond", () => {
    const state = stateWithHand(["5H"], [], ["AC"]);
    const result = discardDiamondToDraw(state, P1, "5H");
    expect(result.ok).toBe(false);
  });
});

describe("discardDiamondForBoost", () => {
  it("discards Diamond and boosts vault", () => {
    const state = stateWithHand(["8D"]);
    const result = discardDiamondForBoost(state, P1, "8D");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hand).not.toContain("8D");
    expect(result.value.players[P1]!.vault.tempBoost).toBe(8);
    expect(result.value.abyss).toContain("8D");
  });
});

describe("duel Diamond respects the active player's one-per-turn allowance", () => {
  function duelCtx() {
    return {
      attackerPlayerId: P1,
      defenderPlayerId: P2,
      duelAttackerPassed: false,
      duelBlockerPassed: false,
      attackerDiamondUsed: false,
      defenderDiamondUsed: false,
    };
  }

  it("bars the attacker (active player) who already spent their turn Diamond", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      activePlayerId: P1,
      deck: ["KH", "2C"],
      duelContext: duelCtx(),
      players: {
        [P1]: makePlayer(P1, { hand: ["5D"], hasPlayedDiamondThisTurn: true }),
        [P2]: makePlayer(P2, { hand: ["6D"] }),
      },
    });
    expect(discardDiamondToDraw(state, P1, "5D").ok).toBe(false);
    expect(discardDiamondForBoost(state, P1, "5D").ok).toBe(false);
  });

  it("lets the attacker take it if unused, and counts it against the turn", () => {
    const state = makeState({
      phase: "duel_attacker_turn",
      activePlayerId: P1,
      deck: ["KH", "2C"],
      duelContext: duelCtx(),
      players: {
        [P1]: makePlayer(P1, { hand: ["5D"] }),
        [P2]: makePlayer(P2, { hand: ["6D"] }),
      },
    });
    const result = discardDiamondToDraw(state, P1, "5D");
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.hasPlayedDiamondThisTurn).toBe(true);
    expect(result.value.duelContext!.attackerDiamondUsed).toBe(true);
  });

  it("still lets the defender (non-active) take their duel Diamond regardless of their turn flag", () => {
    const state = makeState({
      phase: "duel_blocker_turn",
      activePlayerId: P1,
      deck: ["KH", "2C"],
      duelContext: duelCtx(),
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2, { hand: ["6D"], hasPlayedDiamondThisTurn: true }),
      },
    });
    const result = discardDiamondToDraw(state, P2, "6D");
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.value.duelContext!.defenderDiamondUsed).toBe(true);
  });
});

describe("Diamond actions while blocking", () => {
  function blockingState(defenderHand: string[], usedBy: string[] = []) {
    return makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      deck: ["KH", "2C"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: P2 }],
      pendingBlockDefenders: [P2],
      blockDiamondUsedBy: usedBy,
      players: {
        [P1]: makePlayer(P1),
        // Flag set from their OWN last turn — must not block the react action.
        [P2]: makePlayer(P2, { hand: defenderHand, hasPlayedDiamondThisTurn: true }),
      },
    });
  }

  it("lets a blocking defender discard a Diamond to draw", () => {
    const result = discardDiamondToDraw(blockingState(["5D"]), P2, "5D");
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.hand).toContain("KH");
    expect(result.value.blockDiamondUsedBy).toContain(P2);
  });

  it("lets a blocking defender discard a Diamond for a boost", () => {
    const result = discardDiamondForBoost(blockingState(["5D"]), P2, "5D");
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.vault.tempBoost).toBe(5);
    expect(result.value.blockDiamondUsedBy).toContain(P2);
  });

  it("allows only one Diamond action per block window", () => {
    const state = blockingState(["5D", "6D"], [P2]);
    expect(discardDiamondToDraw(state, P2, "5D").ok).toBe(false);
    expect(discardDiamondForBoost(state, P2, "6D").ok).toBe(false);
  });

  it("still forbids banking a Diamond to the Mine while blocking", () => {
    expect(playDiamondToMine(blockingState(["5D"]), P2, "5D").ok).toBe(false);
  });
});
