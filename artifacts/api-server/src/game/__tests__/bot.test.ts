import { describe, it, expect } from "vitest";
import { chooseBotAction, chooseBotInterrupt, fallbackAction, createRng, personaForMatch } from "../bot";
import { dispatchAction, getTurnHolderId } from "../dispatcher";
import { createInitialGameState, dealInitialHands, determineFirstPlayer } from "../setup";
import { isGameOver } from "../turn";
import type { GameState, RoyalInCourt } from "../types";
import { makeState, makePlayer, P1, P2 } from "./helpers";

const BOT = P2;

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

/** Assert the bot picks a legal action for `state` across several rng seeds. */
function expectLegalAcrossSeeds(state: GameState, botId: string) {
  for (const seed of [1, 2, 3, 42, 1337]) {
    const action = chooseBotAction(state, botId, { rng: createRng(seed) });
    const result = dispatchAction(state, botId, action);
    expect(
      result.ok,
      `seed ${seed}: action ${JSON.stringify(action)} rejected: ${result.ok ? "" : result.error}`,
    ).toBe(true);
  }
}

describe("chooseBotAction legality per phase", () => {
  it("main phase with a full hand of playable cards", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D"],
      deck: ["2H", "3H", "4H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")], life: 12 }),
        [BOT]: makePlayer(BOT, {
          hand: ["KD", "5D", "4H", "6S", "7C", "JOKER1", "QS"],
          court: [mkRoyal("JS")],
        }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("main phase with an empty hand still ends the turn", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: [] }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("discard phase with 9 cards", () => {
    const state = makeState({
      phase: "discard",
      activePlayerId: BOT,
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, {
          hand: ["2H", "3S", "4C", "5D", "6H", "7S", "8C", "9D", "KH"],
        }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("declare_blocks with one incoming attack", () => {
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: BOT }],
      pendingBlockDefenders: [BOT],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH", { hasAttackedThisTurn: true })] }),
        [BOT]: makePlayer(BOT, { court: [mkRoyal("QS"), mkRoyal("JD")] }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("declare_blocks with three incoming attacks and no blockers", () => {
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: BOT },
        { attackerPlayerId: P1, attackerCardId: "QC", targetPlayerId: BOT },
        { attackerPlayerId: P1, attackerCardId: "JD", targetPlayerId: BOT },
      ],
      pendingBlockDefenders: [BOT],
      players: {
        [P1]: makePlayer(P1, {
          court: [
            mkRoyal("KH", { hasAttackedThisTurn: true }),
            mkRoyal("QC", { hasAttackedThisTurn: true }),
            mkRoyal("JD", { hasAttackedThisTurn: true }),
          ],
        }),
        [BOT]: makePlayer(BOT, { court: [] }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("assign_damage_order with a two-blocker attack (bot attacking)", () => {
    const state = makeState({
      phase: "assign_damage_order",
      activePlayerId: BOT,
      hasAttackedThisTurn: true,
      attacks: [
        {
          attackerPlayerId: BOT,
          attackerCardId: "KS",
          targetPlayerId: P1,
          blockerCardIds: ["JD", "JH"],
        },
      ],
      duelContext: {
        attackerPlayerId: BOT,
        defenderPlayerId: P1,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("JD"), mkRoyal("JH")] }),
        [BOT]: makePlayer(BOT, { court: [mkRoyal("KS", { hasAttackedThisTurn: true })] }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it.each(["duel_attacker_turn", "duel_blocker_turn"] as const)("%s", (phase) => {
    const isAttacker = phase === "duel_attacker_turn";
    const state = makeState({
      phase,
      activePlayerId: isAttacker ? BOT : P1,
      hasAttackedThisTurn: true,
      attacks: [
        {
          attackerPlayerId: isAttacker ? BOT : P1,
          attackerCardId: "KS",
          targetPlayerId: isAttacker ? P1 : BOT,
          blockerCardIds: ["QD"],
        },
      ],
      duelContext: {
        attackerPlayerId: isAttacker ? BOT : P1,
        defenderPlayerId: isAttacker ? P1 : BOT,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      mine: ["8D"],
      deck: ["2C"],
      players: {
        [P1]: makePlayer(P1, {
          hand: ["3H"],
          court: isAttacker ? [mkRoyal("QD")] : [mkRoyal("KS", { hasAttackedThisTurn: true })],
        }),
        [BOT]: makePlayer(BOT, {
          hand: ["2D", "5H", "6S"],
          court: isAttacker ? [mkRoyal("KS", { hasAttackedThisTurn: true })] : [mkRoyal("QD")],
        }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });

  it("respond_to_club as the targeted defender", () => {
    const state = makeState({
      phase: "respond_to_club",
      activePlayerId: P1,
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "7C",
        targetPlayerId: BOT,
        targetRoyalId: "QH",
        defenderDiamondUsed: false,
      },
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["4H", "3S", "2D"], court: [mkRoyal("QH")] }),
      },
    });
    expectLegalAcrossSeeds(state, BOT);
  });
});

describe("fallbackAction", () => {
  it("is legal in every priority phase state above", () => {
    const states: GameState[] = [
      makeState({ phase: "main", activePlayerId: BOT, deck: ["2H"] }),
      makeState({
        phase: "discard",
        activePlayerId: BOT,
        players: {
          [P1]: makePlayer(P1),
          [BOT]: makePlayer(BOT, { hand: ["2H", "3S", "4C", "5D", "6H", "7S", "8C", "9D"] }),
        },
      }),
      makeState({
        phase: "declare_blocks",
        activePlayerId: P1,
        hasAttackedThisTurn: true,
        attacks: [{ attackerPlayerId: P1, attackerCardId: "KH", targetPlayerId: BOT }],
        pendingBlockDefenders: [BOT],
        players: {
          [P1]: makePlayer(P1, { court: [mkRoyal("KH", { hasAttackedThisTurn: true })] }),
          [BOT]: makePlayer(BOT),
        },
      }),
      makeState({
        phase: "respond_to_club",
        activePlayerId: P1,
        pendingClubDebuff: {
          attackerPlayerId: P1,
          clubCardId: "7C",
          targetPlayerId: BOT,
          targetRoyalId: "QH",
          defenderDiamondUsed: false,
        },
        players: {
          [P1]: makePlayer(P1),
          [BOT]: makePlayer(BOT, { court: [mkRoyal("QH")] }),
        },
      }),
    ];
    for (const state of states) {
      const action = fallbackAction(state, BOT);
      const result = dispatchAction(state, BOT, action);
      expect(
        result.ok,
        `phase ${state.phase}: ${JSON.stringify(action)} rejected: ${result.ok ? "" : result.error}`,
      ).toBe(true);
    }
  });
});

describe("bot-vs-bot playouts (deadlock canary)", () => {
  const MAX_ACTIONS = 3000;
  const GAMES = 25;

  it(`terminates within ${MAX_ACTIONS} actions for ${GAMES} full games`, () => {
    for (let game = 0; game < GAMES; game++) {
      const rng = createRng(game + 1);
      const init = createInitialGameState(`playout-${game}`, [P1, P2]);
      expect(init.ok).toBe(true);
      if (!init.ok) return;
      const withFirst = determineFirstPlayer(init.value);
      expect(withFirst.ok).toBe(true);
      if (!withFirst.ok) return;
      const dealt = dealInitialHands(withFirst.value);
      expect(dealt.ok).toBe(true);
      if (!dealt.ok) return;

      let state = dealt.value;
      let actions = 0;
      let stalemate = false;

      while (!isGameOver(state) && actions < MAX_ACTIONS) {
        const holderId = getTurnHolderId(state);
        expect(holderId, `game ${game}: no turn holder in phase ${state.phase}`).toBeTruthy();
        if (!holderId) return;

        const action = chooseBotAction(state, holderId, { rng });
        const result = dispatchAction(state, holderId, action);
        if (!result.ok) {
          // The only tolerated engine failure is total card exhaustion
          // (deck + abyss empty), which is a stalemate, not a bot bug.
          expect(
            result.error,
            `game ${game}, action ${actions}: ${JSON.stringify(action)} rejected in phase ${state.phase}: ${result.error}`,
          ).toMatch(/no cards to draw/i);
          stalemate = true;
          break;
        }
        state = result.value;
        actions++;
      }

      expect(
        isGameOver(state) || stalemate,
        `game ${game}: did not finish within ${MAX_ACTIONS} actions (stuck in phase ${state.phase})`,
      ).toBe(true);
    }
  }, 60_000);
});

describe("turn progress", () => {
  it("a single bot turn ends within a bounded number of actions", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D", "8D"],
      deck: ["2H", "3H", "4H", "5H", "6H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("JH")] }),
        [BOT]: makePlayer(BOT, {
          hand: ["KD", "5D", "4H", "6S", "7C", "QS", "JC"],
          court: [mkRoyal("KS")],
        }),
      },
    });

    const rng = createRng(7);
    let current: GameState = state;
    let steps = 0;
    const LIMIT = 60;
    while (getTurnHolderId(current) === BOT && steps < LIMIT && !isGameOver(current)) {
      const action = chooseBotAction(current, BOT, { rng });
      const result = dispatchAction(current, BOT, action);
      expect(result.ok, `step ${steps}: ${JSON.stringify(action)}`).toBe(true);
      if (!result.ok) return;
      current = result.value;
      steps++;
    }
    expect(steps).toBeLessThan(LIMIT);
  });
});

describe("chooseBotInterrupt", () => {
  it("plays a beneficial interrupt during the opponent's main phase", () => {
    // Human (P1) is active; bot has a big spade + a royal to buff and vault
    // to pay for it — a clear gain over doing nothing.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D", "9D"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [BOT]: makePlayer(BOT, {
          hand: ["9S", "8H"],
          court: [mkRoyal("QS")],
          life: 12,
        }),
      },
    });
    let sawInterrupt = false;
    for (const seed of [1, 2, 3, 42, 1337]) {
      const action = chooseBotInterrupt(state, BOT, { rng: createRng(seed) });
      if (action) {
        sawInterrupt = true;
        const result = dispatchAction(state, BOT, action);
        expect(
          result.ok,
          `seed ${seed}: interrupt ${JSON.stringify(action)} rejected: ${result.ok ? "" : result.error}`,
        ).toBe(true);
      }
    }
    expect(sawInterrupt).toBe(true);
  });

  it("stays quiet with an empty hand", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: [] }),
      },
    });
    expect(chooseBotInterrupt(state, BOT, { rng: createRng(1) })).toBeNull();
  });

  it("never interrupts outside interruptible phases", () => {
    const state = makeState({
      phase: "discard",
      activePlayerId: P1,
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["2H", "3S", "4C", "5D", "6H", "7S", "8C", "9D"] }),
        [BOT]: makePlayer(BOT, { hand: ["9S"], court: [mkRoyal("QS")] }),
      },
    });
    expect(chooseBotInterrupt(state, BOT, { rng: createRng(1) })).toBeNull();
  });

  it("stays quiet when no play clears the gain threshold", () => {
    // Only a low heart with no royal to attach to and full life — nothing
    // worth doing.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["2H"], court: [], life: 20 }),
      },
    });
    expect(chooseBotInterrupt(state, BOT, { rng: createRng(1) })).toBeNull();
  });
});

describe("softmax variety", () => {
  it("returns more than one distinct action across seeds on a rich state", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("JH")], life: 15 }),
        [BOT]: makePlayer(BOT, {
          hand: ["KD", "5D", "4H", "6S", "7C", "QS"],
          court: [mkRoyal("KS")],
        }),
      },
    });

    const seen = new Set<string>();
    for (let seed = 0; seed < 20; seed++) {
      const action = chooseBotAction(state, BOT, { rng: createRng(seed) });
      seen.add(JSON.stringify(action));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it("personaForMatch is deterministic per match id", () => {
    expect(personaForMatch("match-abc")).toBe(personaForMatch("match-abc"));
  });
});
