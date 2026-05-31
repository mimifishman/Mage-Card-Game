import { describe, it, expect } from "vitest";
import { applyClubToRoyal, confirmClubResponse } from "../clubs";
import { attachHeart } from "../attachments";
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

describe("applyClubToRoyal (staging)", () => {
  it("stages the debuff and enters respond_to_club phase when Royal is targeted", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
        }),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P2, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("respond_to_club");
    expect(result.value.pendingClubDebuff).toEqual({
      attackerPlayerId: P1,
      clubCardId: "3C",
      targetPlayerId: P2,
      targetRoyalId: "KH",
      defenderDiamondUsed: false,
    });
    // Club card removed from hand, not yet in abyss
    expect(result.value.players[P1]!.hand).not.toContain("3C");
    expect(result.value.abyss).not.toContain("3C");
    // Royal not yet modified
    const king = result.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    expect(king.buffAttack).toBe(5);
    expect(king.buffHealth).toBe(5);
  });

  it("resolves immediately (no staging) when no Royal target", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.pendingClubDebuff).toBeUndefined();
    expect(result.value.players[P2]!.life).toBe(17);
  });

  it("rejects targeting your own Royal", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P1, "KH");
    expect(result.ok).toBe(false);
  });

  it("rejects if target Royal not in opponent Court", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, { court: [] }),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P2, "KH");
    expect(result.ok).toBe(false);
  });
});

describe("confirmClubResponse", () => {
  function makeRespondState(overrides: Partial<RoyalInCourt> = {}) {
    return makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: [],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5, ...overrides })],
        }),
      },
    });
  }

  it("reduces target Royal's buffAttack and buffHealth when confirmed", () => {
    const state = makeRespondState();
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.pendingClubDebuff).toBeUndefined();
    const king = result.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    expect(king.buffAttack).toBe(2);
    expect(king.buffHealth).toBe(2);
    // Rule 3: Club card stays in attachedCards for pip-cancellation tracking (not immediately sent to abyss)
    expect(king.attachedCards).toContain("3C");
    expect(result.value.abyss).not.toContain("3C");
  });

  it("destroys Royal when effective health <= 0 and sends Royal + attachments to Abyss", () => {
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "10C",
        targetPlayerId: P2,
        targetRoyalId: "JH",
      },
      players: {
        [P1]: makePlayer(P1, { hand: [], vault: { tempBoost: 0, spent: 10 } }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JH", { attachedCards: ["3H", "QS"] })],
        }),
      },
    });
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const p2Court = result.value.players[P2]!.court;
    expect(p2Court.find((r) => r.cardId === "JH")).toBeUndefined();
    expect(result.value.abyss).toContain("JH");
    expect(result.value.abyss).toContain("3H");
    expect(result.value.abyss).toContain("QS");
    expect(result.value.abyss).toContain("10C");
  });

  it("destroys Royal when debuff kills it, no life loss (Rule 6)", () => {
    // Rule 6: When a Royal is killed by a Club, the controller does NOT lose life.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "2C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
      },
      players: {
        [P1]: makePlayer(P1, { hand: [], vault: { tempBoost: 0, spent: 2 } }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffHealth: 2, damageTaken: 3 })],
        }),
      },
    });
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
    // No life loss from Club kill (Rule 6)
    expect(result.value.players[P2]!.life).toBe(20);
    expect(result.value.players[P1]!.life).toBe(20);
  });

  it("clamps life loss to 0 when debuff makes maxHp negative", () => {
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "9C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
      },
      players: {
        [P1]: makePlayer(P1, { hand: [], vault: { tempBoost: 0, spent: 9 } }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffHealth: 5 })],
        }),
      },
    });
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(0);
    expect(result.value.players[P2]!.life).toBe(20);
  });

  it("does not reduce target player life when debuff does not kill the Royal", () => {
    const state = makeRespondState();
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.players[P2]!.court).toHaveLength(1);
    expect(result.value.players[P2]!.life).toBe(20);
  });

  it("rejects if called by the attacker instead of defender", () => {
    const state = makeRespondState();
    const result = confirmClubResponse(state, P1);
    expect(result.ok).toBe(false);
  });

  it("rejects if called outside respond_to_club phase", () => {
    const state = makeState({
      players: {
        [P1]: makePlayer(P1),
        [P2]: makePlayer(P2),
      },
    });
    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(false);
  });

  it("defender can counter-Club an opponent Royal during window without clearing pendingClubDebuff", () => {
    // P1 staged a debuff against P2's KH. P2 retaliates by playing 4C against P1's QH.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: [],
          court: [mkRoyal("QH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["4C"],
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // Defender (P2) plays 4C against P1's QH
    const result = applyClubToRoyal(state, P2, "4C", P1, "QH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Original pendingClubDebuff should still be present
    expect(result.value.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P1,
      clubCardId: "3C",
      targetPlayerId: P2,
      targetRoyalId: "KH",
    });

    // Counter-debuff applied to P1's QH
    const qh = result.value.players[P1]!.court.find((r) => r.cardId === "QH");
    expect(qh).toBeDefined();
    expect(qh!.buffAttack).toBe(1); // 5 - 4
    expect(qh!.buffHealth).toBe(1); // 5 - 4

    // Rule 3: 4C is now in QH's attachedCards (Club stored for pip-cancellation), not abyss
    expect(qh!.attachedCards).toContain("4C");
    expect(result.value.abyss).not.toContain("4C");
    expect(result.value.abyss).not.toContain("3C");

    // Phase stays respond_to_club
    expect(result.value.phase).toBe("respond_to_club");

    // Original debuff can still be confirmed
    const confirmed = confirmClubResponse(result.value, P2);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.phase).toBe("main");
    expect(confirmed.value.pendingClubDebuff).toBeUndefined();
    // Rule 3: 3C stays in KH's attachedCards (KH survives the 3-pip debuff with buffHealth 5→2)
    const khAfterConfirm = confirmed.value.players[P2]!.court.find((r) => r.cardId === "KH");
    expect(khAfterConfirm!.attachedCards).toContain("3C");
    expect(confirmed.value.abyss).not.toContain("3C");
  });

  it("defender direct Club damage during window preserves pendingClubDebuff", () => {
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: [],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["2C"],
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // Defender deals direct damage to P1's life
    const result = applyClubToRoyal(state, P2, "2C", P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Direct damage applied
    expect(result.value.players[P1]!.life).toBe(18);
    expect(result.value.abyss).toContain("2C");

    // Original pendingClubDebuff preserved
    expect(result.value.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P1,
      clubCardId: "3C",
      targetPlayerId: P2,
      targetRoyalId: "KH",
    });

    // Can still confirm
    const confirmed = confirmClubResponse(result.value, P2);
    expect(confirmed.ok).toBe(true);
  });

  it("Club-on-Royal during declare_blocks resolves immediately without staging (preserves combat flow)", () => {
    // During declare_blocks the defender may play a Club against an attacker's Royal.
    // This must resolve immediately — NOT enter respond_to_club — so combat can proceed.
    // canPlayCard checks attacks[0].targetPlayerId to identify the defender.
    const state = makeState({
      phase: "declare_blocks",
      mine: ["10D"],
      attacks: [
        {
          attackerPlayerId: P1,
          attackerCardId: "QH",
          targetPlayerId: P2,
          blockerCardIds: undefined,
          passed: false,
        },
      ],
      players: {
        [P1]: makePlayer(P1, {
          hand: [],
          court: [mkRoyal("QH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["3C"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = applyClubToRoyal(state, P2, "3C", P1, "QH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Phase must stay in declare_blocks — NOT switch to respond_to_club
    expect(result.value.phase).toBe("declare_blocks");
    expect(result.value.pendingClubDebuff).toBeUndefined();

    // Debuff applied immediately
    const qh = result.value.players[P1]!.court.find((r) => r.cardId === "QH");
    expect(qh).toBeDefined();
    expect(qh!.buffAttack).toBe(2); // 5 - 3
    expect(qh!.buffHealth).toBe(2); // 5 - 3

    // 3C is now attached to the Royal (Rule 3: Club stored in attachedCards for cancellation)
    const qhAfter = result.value.players[P1]!.court.find((r) => r.cardId === "QH");
    expect(qhAfter!.attachedCards).toContain("3C");
  });

  it("full flow: stage then confirm with Royal buffed during window", () => {
    // Set up: P1 plays 3C to debuff P2's KH
    const initial = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["3H"],
          court: [mkRoyal("KH", { buffAttack: 0, buffHealth: 0 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // Stage the debuff
    const staged = applyClubToRoyal(initial, P1, "3C", P2, "KH");
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;
    expect(staged.value.phase).toBe("respond_to_club");

    // Confirm without playing anything
    const confirmed = confirmClubResponse(staged.value, P2);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.phase).toBe("main");
    const king = confirmed.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    // KH base HP = 3, pipValue of 3C = 3, so buffHealth = 0 - 3 = -3, effectiveHealth = 3 + (-3) - 0 = 0 => dead
    expect(confirmed.value.players[P2]!.court).toHaveLength(0);
  });

  it("Club-on-Royal during duel stages respond_to_club so defender can respond", () => {
    // During a duel the attacker plays a Club on the blocker's Royal.
    // This must enter respond_to_club (NOT apply immediately) so the defender
    // has a window to play Hearts/Spades to save their Royal.
    // After confirmClubResponse the game returns to the original duel phase.
    const state = makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      activePlayerId: P1,
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // Attacker plays 3C on defender's KH → must stage, NOT apply immediately
    const staged = applyClubToRoyal(state, P1, "3C", P2, "KH");
    expect(staged.ok).toBe(true);
    if (!staged.ok) return;

    expect(staged.value.phase).toBe("respond_to_club");
    expect(staged.value.pendingClubDebuff).toMatchObject({
      attackerPlayerId: P1,
      clubCardId: "3C",
      targetPlayerId: P2,
      targetRoyalId: "KH",
      returnPhase: "duel_attacker_turn",
    });
    // Royal NOT yet debuffed — defender still has a chance to respond
    const khBeforeConfirm = staged.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    expect(khBeforeConfirm.buffAttack).toBe(5);
    expect(khBeforeConfirm.buffHealth).toBe(5);

    // Defender (P2) confirms without playing any extra cards
    const confirmed = confirmClubResponse(staged.value, P2);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;

    // Phase returns to the duel
    expect(confirmed.value.phase).toBe("duel_attacker_turn");
    expect(confirmed.value.pendingClubDebuff).toBeUndefined();

    // Debuff now applied
    const khAfter = confirmed.value.players[P2]!.court.find((r) => r.cardId === "KH")!;
    expect(khAfter.buffAttack).toBe(2); // 5 - 3
    expect(khAfter.buffHealth).toBe(2); // 5 - 3
    expect(khAfter.attachedCards).toContain("3C");
  });

  it("blocker can play Heart during duel respond_to_club window to save Royal", () => {
    // Attacker plays 3C on blocker's KH (base hp=3, no buffs). Without intervention
    // the Royal dies. Defender attaches 5H during the window, boosting hp enough to survive.
    const staged = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "KH",
        defenderDiamondUsed: false,
        returnPhase: "duel_attacker_turn" as const,
      },
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
      },
      players: {
        [P1]: makePlayer(P1, { vault: { tempBoost: 0, spent: 3 } }),
        [P2]: makePlayer(P2, {
          hand: ["5H"],
          court: [mkRoyal("KH")], // base hp=3, no buffs — would die to 3C alone
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // Defender attaches 5H to shore up KH's health (+5 buff)
    const withHeart = attachHeart(staged, P2, "5H", "KH");
    expect(withHeart.ok).toBe(true);
    if (!withHeart.ok) return;

    // Confirm — 3C applied. effectiveHealth = 3+5-3 = 5 > 0, Royal survives
    const confirmed = confirmClubResponse(withHeart.value, P2);
    expect(confirmed.ok).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.phase).toBe("duel_attacker_turn");

    const kh = confirmed.value.players[P2]!.court.find((r) => r.cardId === "KH");
    expect(kh).toBeDefined(); // KH alive!
    expect(kh!.buffHealth).toBe(2); // 5H buff(+5) − 3C debuff(-3) = +2
    expect(kh!.attachedCards).toContain("5H");
    expect(kh!.attachedCards).toContain("3C");
  });
});
