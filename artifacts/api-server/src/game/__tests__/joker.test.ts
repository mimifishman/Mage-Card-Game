import { describe, it, expect } from "vitest";
import { playJokerDestroyRoyal, playJokerDamagePlayer, playJoker } from "../joker";
import { dispatchAction } from "../dispatcher";
import { isGameOver, getWinner } from "../turn";
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

function richState(jokerCard: string = "JOKER1", p2Overrides: Partial<ReturnType<typeof makePlayer>> = {}) {
  return makeState({
    mine: ["10D"],
    players: {
      [P1]: makePlayer(P1, {
        hand: [jokerCard],
        vault: { tempBoost: 0, spent: 0 },
      }),
      [P2]: makePlayer(P2, p2Overrides),
    },
  });
}

describe("playJokerDestroyRoyal", () => {
  it("destroys target Royal and sends it + attachments to Abyss", () => {
    const state = richState("JOKER1", {
      court: [mkRoyal("KH", { attachedCards: ["4H", "JS"] })],
    });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
    expect(result.value.abyss).toContain("KH");
    expect(result.value.abyss).toContain("4H");
    expect(result.value.abyss).toContain("JS");
    expect(result.value.abyss).toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
  });

  it("rejects when vault < 10", () => {
    const state = makeState({
      mine: ["5D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KH")] }),
      },
    });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in Court", () => {
    const state = richState("JOKER1", { court: [] });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("does not reduce target player life when Royal is destroyed (unbuffed King)", () => {
    const state = richState("JOKER1", { court: [mkRoyal("KH")] });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(20);
    expect(result.value.players[P1]!.life).toBe(20);
  });

  it("does not reduce target player life when buffed Royal is destroyed (buffed King)", () => {
    const state = richState("JOKER1", { court: [mkRoyal("KH", { buffHealth: 2 })] });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(20);
    expect(result.value.players[P1]!.life).toBe(20);
  });

  it("rejects if not a Joker card", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["10H"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { court: [mkRoyal("KH")] }),
      },
    });
    const result = playJokerDestroyRoyal(state, P1, "10H", P2, "KH");
    expect(result.ok).toBe(false);
  });

  it("allows destroying your own Royal (universal targeting rule) and still spends Vault + removes the Joker", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["JOKER1"],
          court: [mkRoyal("KH", { attachedCards: ["4H"] })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P1, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.court).toHaveLength(0);
    expect(result.value.players[P1]!.hand).not.toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
    expect(result.value.abyss).toContain("KH");
    expect(result.value.abyss).toContain("4H");
    expect(result.value.abyss).toContain("JOKER1");
  });
});

describe("playJoker (unified entry point)", () => {
  it("routes destroy_royal mode correctly", () => {
    const state = richState("JOKER1", { court: [mkRoyal("KH")] });
    const result = playJoker(state, P1, "JOKER1", "destroy_royal", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
  });

  it("routes damage_player mode correctly", () => {
    const state = richState("JOKER1", { life: 20 });
    const result = playJoker(state, P1, "JOKER1", "damage_player", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(10);
  });

  it("rejects destroy_royal mode without targetCardId", () => {
    const state = richState("JOKER1");
    const result = playJoker(state, P1, "JOKER1", "destroy_royal", P2);
    expect(result.ok).toBe(false);
  });
});

describe("playJokerDamagePlayer", () => {
  it("deals 10 damage to target player", () => {
    const state = richState("JOKER1", { life: 20 });
    const result = playJokerDamagePlayer(state, P1, "JOKER1", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.life).toBe(10);
    expect(result.value.abyss).toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
  });

  it("allows targeting yourself (universal targeting rule) and still spends Vault + removes the Joker", () => {
    const state = richState("JOKER1", { life: 20 });
    const result = playJokerDamagePlayer(state, P1, "JOKER1", P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P1]!.life).toBe(10);
    expect(result.value.players[P1]!.hand).not.toContain("JOKER1");
    expect(result.value.players[P1]!.vault.spent).toBe(10);
    expect(result.value.abyss).toContain("JOKER1");
  });
});

describe("lethal Joker to the face opens a response window", () => {
  it("opens respond_to_club with no life lost when a face Joker is lethal", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["JOKER1"] }),
        [P2]: makePlayer(P2, { life: 8 }),
      },
    });
    const result = playJokerDamagePlayer(state, P1, "JOKER1", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("respond_to_club");
    expect(result.value.pendingClubDebuff?.faceDamage).toEqual({
      sourceCardId: "JOKER1",
      amount: 10,
    });
    expect(result.value.players[P2]!.life).toBe(8);
    expect(result.value.players[P2]!.isEliminated).toBe(false);
  });

  it("kills on confirm when the defender cannot answer it", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["JOKER1"] }),
        [P2]: makePlayer(P2, { life: 8, hand: [] }),
      },
    });
    const opened = dispatchAction(state, P1, {
      type: "play_joker",
      cardId: "JOKER1",
      mode: "damage_player",
      targetPlayerId: P2,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const confirmed = dispatchAction(opened.value, P2, { type: "confirm_club_response" });
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.players[P2]!.isEliminated).toBe(true);
    expect(isGameOver(confirmed.value)).toBe(true);
    expect(getWinner(confirmed.value)).toBe(P1);
  });
});

describe("Joker destroy logs a royal_destroyed event", () => {
  it("records who destroyed which Royal with what, so the removal isn't silent", () => {
    const state = richState("JOKER1", { court: [mkRoyal("KH", { buffAttack: 4, buffHealth: 4 })] });
    const result = playJokerDestroyRoyal(state, P1, "JOKER1", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
    const ev = result.value.lifeEvents!.at(-1)!;
    expect(ev.kind).toBe("royal_destroyed");
    expect(ev.destroyedRoyalId).toBe("KH");
    expect(ev.sourceCardId).toBe("JOKER1");
    expect(ev.actorPlayerId).toBe(P1);
    expect(ev.targetPlayerId).toBe(P2);
  });
});
