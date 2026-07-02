import { describe, it, expect } from "vitest";
import { applyClubToRoyal, confirmClubResponse } from "../clubs";
import { attachHeart, attachSpade } from "../attachments";
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

  it("allows targeting your own Royal", () => {
    const state = makeState({
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2),
      },
    });
    const result = applyClubToRoyal(state, P1, "3C", P1, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("respond_to_club");
    expect(result.value.pendingClubDebuff).toEqual({
      attackerPlayerId: P1,
      clubCardId: "3C",
      targetPlayerId: P1,
      targetRoyalId: "KH",
      defenderDiamondUsed: false,
    });
  });

  it("allows dealing direct Club damage to yourself", () => {
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
    const result = applyClubToRoyal(state, P1, "3C", P1);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.phase).toBe("main");
    expect(result.value.pendingClubDebuff).toBeUndefined();
    expect(result.value.players[P1]!.life).toBe(17);
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

describe("per-pair duel resolution (Task: end duel pair when Royal is debuffed)", () => {
  it("Club debuff on the only blocked pair immediately resolves combat (goes to main)", () => {
    // KH (P1) attacks, JD (P2) blocks. Attacker plays 3C on JD.
    // Confirming the debuff should mark the pair resolved and, since it's the
    // only blocked pair, immediately execute combat and go to "main".
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All pairs resolved → combat immediately proceeds to main
    expect(result.value.phase).toBe("main");
    expect(result.value.attacks).toHaveLength(0);
    expect(result.value.duelContext).toBeUndefined();
  });

  it("Club debuff on one of two pairs marks that pair resolved but leaves the duel active", () => {
    // KH (P1) attacks JD (P2). QS (P1) attacks AC (P2). Debuff lands on JD → KH/JD pair resolved.
    // QS/AC pair is still unresolved → duel should continue.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
        { attackerPlayerId: P1, attackerCardId: "QS", targetPlayerId: P2, blockerCardIds: ["AC"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: ["5H"],
          court: [mkRoyal("KH", { buffAttack: 5, buffHealth: 5 }), mkRoyal("QS")],
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["5H"],
          court: [mkRoyal("JD", { buffAttack: 5, buffHealth: 5 }), mkRoyal("AC")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Duel still active — not all pairs resolved
    expect(result.value.phase).toBe("duel_attacker_turn");
    expect(result.value.duelContext).toBeDefined();
    expect(result.value.duelContext!.resolvedPairAttackerIds).toContain("KH");
    expect(result.value.duelContext!.resolvedPairAttackerIds).not.toContain("QS");
  });

  it("rejects Club targeting a Royal in a pair whose duel has already ended", () => {
    // KH/JD pair already resolved. Attacker tries to play another Club on JD.
    const state = makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: ["KH"],
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD", { buffAttack: 5, buffHealth: 5 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = applyClubToRoyal(state, P1, "3C", P2, "JD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/pair whose duel has already ended/i);
  });

  it("rejects attachHeart targeting a Royal in a resolved pair", () => {
    // After KH/JD pair is resolved, defender cannot buff JD (their blocker) with a Heart.
    const state = makeState({
      phase: "duel_blocker_turn",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: ["KH"],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["5H"],
          court: [mkRoyal("JD")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = attachHeart(state, P2, "5H", "JD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/pair whose duel has already ended/i);
  });

  it("rejects attachSpade targeting a Royal in a resolved pair", () => {
    const state = makeState({
      phase: "duel_blocker_turn",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: ["KH"],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["4S"],
          court: [mkRoyal("JD")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = attachSpade(state, P2, "4S", "JD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/pair whose duel has already ended/i);
  });

  it("Club debuff that destroys a Royal in a blocked pair also resolves that pair immediately", () => {
    // JD has low health — 10C debuff kills it outright. The pair (KH/JD) should be
    // marked resolved AND combat resolved since it's the only blocked pair.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "10C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH")],
          vault: { tempBoost: 0, spent: 10 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD")], // base hp=1, no buffs — dies to 10C
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Royal destroyed
    expect(result.value.players[P2]!.court.find((r) => r.cardId === "JD")).toBeUndefined();
    // Combat resolved immediately after pair ended
    expect(result.value.phase).toBe("main");
    expect(result.value.attacks).toHaveLength(0);
    expect(result.value.duelContext).toBeUndefined();
  });

  it("counter-Club during respond_to_club window (duel origin) marks the counter-debuffed pair resolved", () => {
    // P1 staged a Club against P2's JD (returnPhase = duel_attacker_turn).
    // P2 now counter-Clubs P1's KH during the response window.
    // The KH/JD pair should be marked resolved in resolvedPairAttackerIds
    // (but combat does NOT execute yet — that waits for confirmClubResponse).
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          // buffHealth: 20 ensures KH survives the 4C debuff (pip 4 → buffHealth -4)
          court: [mkRoyal("KH", { buffHealth: 20 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          hand: ["4C"],
          court: [mkRoyal("JD", { buffHealth: 20 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // P2 counter-Clubs P1's KH
    const result = applyClubToRoyal(state, P2, "4C", P1, "KH");
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Still in respond_to_club (waiting for P2 to confirm)
    expect(result.value.phase).toBe("respond_to_club");
    // The pending original debuff is preserved
    expect(result.value.pendingClubDebuff?.targetRoyalId).toBe("JD");
    // KH's pair (attacker "KH") is now marked resolved
    expect(result.value.duelContext?.resolvedPairAttackerIds).toContain("KH");
    // KH is debuffed by 4C (pip 4): buffAttack 0 → -4, buffHealth 20 → 16
    const kh = result.value.players[P1]!.court.find((r) => r.cardId === "KH");
    expect(kh).toBeDefined();
    expect(kh?.buffAttack).toBe(-4);
    expect(kh?.buffHealth).toBe(16);
  });

  it("counter-Club resolve + confirmClubResponse completes combat when only one pair exists", () => {
    // Continuation of the scenario above: after the counter-Club marks the pair,
    // confirmClubResponse applies the original debuff and should trigger combat.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        // Pair already marked resolved by the counter-Club in applyClub
        resolvedPairAttackerIds: ["KH"],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { buffHealth: 20 })],
          vault: { tempBoost: 0, spent: 10 },
        }),
        [P2]: makePlayer(P2, {
          // buffHealth: 20 ensures JD survives the 3C debuff (pip 3 → buffHealth -3)
          court: [mkRoyal("JD", { buffHealth: 20 })],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // Pair already resolved → markDuelPairResolved still checks allResolved → executes combat.
    expect(result.value.phase).toBe("main");
    expect(result.value.attacks).toHaveLength(0);
    expect(result.value.duelContext).toBeUndefined();
    // Original Club debuff (3C, pip 3) applied to JD: buffAttack 0 → -3, buffHealth 20 → 17
    const jd = result.value.players[P2]!.court.find((r) => r.cardId === "JD");
    expect(jd).toBeDefined();
    expect(jd?.buffAttack).toBe(-3);
    expect(jd?.buffHealth).toBe(17);
  });

  it("rejects Club targeting a bench Royal (not in any blocked pair) during duel with blocked pairs", () => {
    // P1 has two Royals: KH is attacking with a blocker, QH is a bench Royal.
    // P1 should NOT be able to Club P2's bench Royal QD during the duel.
    const state = makeState({
      phase: "duel_attacker_turn",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: P2,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3C"],
          court: [mkRoyal("KH"), mkRoyal("QH")],
          vault: { tempBoost: 0, spent: 0 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD"), mkRoyal("QD")],
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    // QD is a bench Royal — not part of any blocked pair
    const result = applyClubToRoyal(state, P1, "3C", P2, "QD");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/active duel pair/i);
  });

  it("regression: debuffed Royal that survives the Club is NOT killed by subsequent combat damage", () => {
    // KH (P1, very high attack) is blocked by JD (P2, moderate health).
    // A 3C Club debuff reduces JD's buffHealth from 5 → 2 (effectiveHealth 1+2=3, alive).
    // Without the fix, executeResolveCombat would then apply KH's massive attack to JD and
    // kill it even though the pair was already resolved. With the fix JD must survive.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: P2, blockerCardIds: ["JD"] },
      ],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "3C",
        targetPlayerId: P2,
        targetRoyalId: "JD",
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
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { buffAttack: 50 })], // extremely high attack to guarantee kill without fix
          vault: { tempBoost: 0, spent: 3 },
        }),
        [P2]: makePlayer(P2, {
          court: [mkRoyal("JD", { buffHealth: 5 })], // effectiveHealth = 1+5 = 6; survives 3C (pip 3 → buffHealth 2)
          vault: { tempBoost: 0, spent: 0 },
        }),
      },
    });

    const result = confirmClubResponse(state, P2);
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    // All pairs resolved → combat goes to main
    expect(result.value.phase).toBe("main");

    // JD survived the debuff (effectiveHealth = 1 + (5-3) = 3 > 0)
    const jd = result.value.players[P2]!.court.find((r) => r.cardId === "JD");
    expect(jd).toBeDefined(); // must NOT be in abyss

    // No combat damage applied to JD (pair was resolved — KH's attack skipped)
    expect(jd!.damageTaken).toBe(0);
    expect(jd!.buffHealth).toBe(2); // 5 - 3 from the 3C pip
  });
});
