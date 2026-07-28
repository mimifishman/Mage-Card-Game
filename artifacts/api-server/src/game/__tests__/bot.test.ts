import { describe, it, expect } from "vitest";
import {
  chooseBotAction,
  chooseBotInterrupt,
  enumerateCandidateActions,
  fallbackAction,
  createRng,
  personaForMatch,
} from "../bot";
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
  }, 120_000);
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

  it("plays with FROZEN vault during the human's turn (the real mid-turn shape)", () => {
    // Bot is non-active: its Vault is frozen at 8 (mine total when its turn
    // ended, nothing spent). A 6♠ attach on its own Royal is affordable and
    // clearly beneficial — the interrupt must fire despite the frozen Vault.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: [],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [BOT]: makePlayer(BOT, {
          hand: ["6S"],
          court: [mkRoyal("QS")],
          vault: { tempBoost: 0, spent: 0, frozenMineTotal: 8 },
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
          `seed ${seed}: ${JSON.stringify(action)} rejected: ${result.ok ? "" : result.error}`,
        ).toBe(true);
      }
    }
    expect(sawInterrupt).toBe(true);
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

describe("settle-scoring strategy", () => {
  it("attacks a blocker-less low-life opponent (aggression survives the readiness term)", () => {
    // Bot's K♠ (⚔3) vs a blocker-less opponent at 3 life: settle-scoring sees
    // the unblocked hit landing, so declare_attack must be the top-scored
    // choice. Near-zero temperature makes sampling ≈ argmax so the assertion
    // is deterministic.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { life: 3, court: [] }),
        [BOT]: makePlayer(BOT, { court: [mkRoyal("KS")], hand: [] }),
      },
    });
    const sharpPersona = { ...personaForMatch("any"), temperature: 0.01 };
    for (const seed of [1, 2, 3]) {
      const action = chooseBotAction(state, BOT, { persona: sharpPersona, rng: createRng(seed) });
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("declare_attack");
    }
  });

  it("declines an attack that clearly donates a big Royal", () => {
    // The bot's lone K♠ (⚔3 ♥3) faces a K♥ buffed to ⚔3 ♥4: it blocks, kills
    // the K♠ and survives — a free removal of a whole KING, worth far more than
    // any chip damage, so even a light-blocking opponent always makes this
    // block. settleForScoring must predict it and decline the swing.
    //
    // With DEFENDER_PASS_BIAS the bot now assumes ~human blocking and WILL poke
    // cheap Royals (a 1/1 Jack) for chip damage — that is the intended
    // aggression. This guards the other end: throwing away a King is still
    // declined, because a King's block margin dwarfs the bias.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { life: 20, court: [mkRoyal("KH", { buffHealth: 1 })] }),
        [BOT]: makePlayer(BOT, { life: 19, court: [mkRoyal("KS")], hand: [] }),
      },
    });
    const sharpPersona = { ...personaForMatch("any"), temperature: 0.01 };
    for (const seed of [1, 2, 3]) {
      const action = chooseBotAction(state, BOT, { persona: sharpPersona, rng: createRng(seed) });
      expect(action.type, `seed ${seed} picked ${action.type}`).not.toBe("declare_attack");
    }
  });

  it("enumerates a legal gang-block when no single blocker can kill", () => {
    // Q♥ (⚔2 ♥2) attacks; the bot's two Jacks (⚔1 each) can only kill it
    // together — the gang-block candidate must exist and be engine-legal.
    const state = makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      attacks: [{ attackerPlayerId: P1, attackerCardId: "QH", targetPlayerId: BOT }],
      pendingBlockDefenders: [BOT],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH", { hasAttackedThisTurn: true })] }),
        [BOT]: makePlayer(BOT, { court: [mkRoyal("JD"), mkRoyal("JH")] }),
      },
    });
    const gang = enumerateCandidateActions(state, BOT).find(
      (a) =>
        a.type === "confirm_declare_blocks" &&
        Object.values(a.blocks).some((v) => Array.isArray(v) && v.length === 2),
    );
    expect(gang).toBeTruthy();
    const result = dispatchAction(state, BOT, gang!);
    expect(result.ok, result.ok ? "" : result.error).toBe(true);
  });
});

describe("abyss reclaim when rebuilding", () => {
  // Fixed persona (hash-independent) + near-zero temperature ≈ argmax, so
  // these choices are deterministic regardless of which archetype a match id
  // would hash to.
  const sharp = {
    name: "test-sharp",
    selfLife: 1,
    aggression: 1,
    board: 1.2,
    oppBoard: 1,
    hand: 0.7,
    economy: 0.35,
    reserve: 0.9,
    temperature: 0.01,
  };

  it("reclaims a Royal from the Abyss with a Spade when its court is empty", () => {
    // Court empty, no Royal in hand, K♥ in the Abyss, affordable 5♠ in hand
    // (plus an inert 2♥ so the reactive-cards reserve factor doesn't flip).
    // The 4♣ decoy (pip 4 > K's pip 3) guards the enumeration fix: royals
    // must be preferred over higher-pip junk when picking the reclaim target.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C"],
      abyss: ["KH", "4C"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["5S", "2H"], court: [] }),
      },
    });
    for (const seed of [1, 2, 3]) {
      const action = chooseBotAction(state, BOT, { persona: sharp, rng: createRng(seed) });
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("discard_spade_to_return");
      if (action.type === "discard_spade_to_return") {
        expect(action.targetCardId).toBe("KH");
        const result = dispatchAction(state, BOT, action);
        expect(result.ok, result.ok ? "" : result.error).toBe(true);
      }
    }
  });

  it("still plays a Royal from hand onto an empty court (access bonus must not distort it)", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH")] }),
        [BOT]: makePlayer(BOT, { hand: ["KS"], court: [] }),
      },
    });
    for (const seed of [1, 2, 3]) {
      const action = chooseBotAction(state, BOT, { persona: sharp, rng: createRng(seed) });
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("play_royal_to_court");
    }
  });

  it("offers reclaiming a Royal to rebuild, not only the top-value card", () => {
    // A 10♠ can reach either Abyss card. The 9♥ has a higher raw card value
    // than the J♦ (cardPotential 4.5 vs 4), so the old single-best reclaim
    // offered ONLY the 9♥ — which never gives the bot a body. reclaimTargets
    // must also surface the Royal so the bot can rebuild when a body is worth
    // more than raw value. (Whether it's ultimately chosen depends on the
    // Spade's Vault cost, so this asserts the option exists, at enumeration.)
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D"],
      abyss: ["9H", "JD"],
      players: {
        [P1]: makePlayer(P1, { court: [] }),
        [BOT]: makePlayer(BOT, { hand: ["10S"], court: [] }),
      },
    });
    const reclaimTargetIds = enumerateCandidateActions(state, BOT)
      .filter((a) => a.type === "discard_spade_to_return")
      .map((a) => (a.type === "discard_spade_to_return" ? a.targetCardId : ""));
    expect(reclaimTargetIds).toContain("JD"); // the Royal, so a body is reachable
    expect(reclaimTargetIds).toContain("9H"); // the top-value card still offered
  });
});

describe("strategy matrix — every card type gets played when clearly best", () => {
  // Fixed persona + near-zero temperature ≈ argmax: deterministic choices,
  // independent of which archetype a match id hashes to. Each test builds a
  // state where one play is clearly correct and asserts the bot makes it.
  const sharp = {
    name: "test-sharp",
    selfLife: 1,
    aggression: 1,
    board: 1.2,
    oppBoard: 1,
    hand: 0.7,
    economy: 0.35,
    reserve: 0.9,
    temperature: 0.01,
  };
  const seeds = [1, 2, 3];

  const choose = (state: GameState, seed: number) =>
    chooseBotAction(state, BOT, { persona: sharp, rng: createRng(seed) });

  it("Diamond: takes a Diamond action instead of wasting the turn", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["9D"] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(
        ["play_diamond_to_mine", "discard_diamond_to_draw"],
        `seed ${seed} picked ${action.type}`,
      ).toContain(action.type);
    }
  });

  it.each(["JS", "QS", "KS"])("Royal %s: deploys onto an empty court when affordable", (royalId) => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH")] }),
        [BOT]: makePlayer(BOT, { hand: [royalId], court: [] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("play_royal_to_court");
    }
  });

  it("Heart: attaches to its Royal when at full life", () => {
    // KS is haste-locked so it cannot attack. Without that the bot correctly
    // prefers swinging: P1's lone QH (2/2) cannot kill a KS (3/3), so trading
    // it away is bad for P1 and the modelled defender passes, making the
    // attack 3 free damage. That is good play, not a Heart bug — and this
    // suite is about each card type being played "when clearly best", so the
    // competing attack has to be off the table for the case to mean anything.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH")] }),
        [BOT]: makePlayer(BOT, {
          hand: ["5H", "2D"],
          court: [mkRoyal("KS", { hasteLocked: true })],
          life: 20,
        }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("attach_heart");
    }
  });

  it("Heart: heals itself when damaged with no court to buff", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["6H"], court: [], life: 8 }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("discard_heart_to_heal");
    }
  });

  it("Spade: attaches to its Royal (Abyss empty, so no reclaim option)", () => {
    // KS is haste-locked so attacking is not on the table: a lone QH (2/2)
    // can't kill a KS (3/3), so swinging would push free damage and out-score
    // buffing. This suite is about each card type being played "when clearly
    // best", so the competing attack has to be off the table for the Spade
    // decision to mean anything.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      abyss: [],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("QH")] }),
        [BOT]: makePlayer(BOT, { hand: ["6S"], court: [mkRoyal("KS", { hasteLocked: true })] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("attach_spade");
    }
  });

  it("Club: kills a big opposing Royal over burning face damage", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH")] }),
        [BOT]: makePlayer(BOT, { hand: ["3C"] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("apply_club");
      if (action.type === "apply_club") expect(action.targetRoyalId).toBe("KH");
    }
  });

  it("Club: burns for face damage when the opponent has no court", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [] }),
        [BOT]: makePlayer(BOT, { hand: ["5C"] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("apply_club");
      if (action.type === "apply_club") expect(action.targetRoyalId).toBeUndefined();
    }
  });

  it("Joker: destroys a buffed-up Royal threat", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D", "AD"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH", { buffAttack: 4, buffHealth: 4 })] }),
        [BOT]: makePlayer(BOT, { hand: ["JOKER1"] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("play_joker");
      if (action.type === "play_joker") expect(action.mode).toBe("destroy_royal");
    }
  });

  it("Joker: goes to the face when the opponent has no court", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D", "AD"],
      deck: ["2H"],
      players: {
        [P1]: makePlayer(P1, { court: [] }),
        [BOT]: makePlayer(BOT, { hand: ["JOKER1"] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("play_joker");
      if (action.type === "play_joker") expect(action.mode).toBe("damage_player");
    }
  });

  it("Duel: clubs the attacking Royal instead of passing (D1)", () => {
    const state = makeState({
      phase: "duel_blocker_turn",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      mine: ["10D"],
      deck: ["2H"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: BOT, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: BOT,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KS", { hasAttackedThisTurn: true })] }),
        [BOT]: makePlayer(BOT, { hand: ["3C"], court: [mkRoyal("JD")] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("apply_club");
      if (action.type === "apply_club") expect(action.targetRoyalId).toBe("KS");
      const result = dispatchAction(state, BOT, action);
      expect(result.ok, result.ok ? "" : result.error).toBe(true);
    }
  });

  it("Duel: Jokers a buffed attacker instead of passing (D1)", () => {
    const state = makeState({
      phase: "duel_blocker_turn",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      mine: ["10D", "9D", "AD"],
      deck: ["2H"],
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: BOT, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: BOT,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KS", { hasAttackedThisTurn: true, buffAttack: 4, buffHealth: 4 })],
        }),
        [BOT]: makePlayer(BOT, { hand: ["JOKER1"], court: [mkRoyal("JD")] }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("play_joker");
      if (action.type === "play_joker") expect(action.targetRoyalId).toBe("KS");
      const result = dispatchAction(state, BOT, action);
      expect(result.ok, result.ok ? "" : result.error).toBe(true);
    }
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

describe("previously-missing card plays are now generated", () => {
  it("does not offer attach_royal_support — the engine forbids Royal-on-Royal attachments", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D", "9D"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["KD"], court: [mkRoyal("JS")] }),
      },
    });
    const candidates = enumerateCandidateActions(state, BOT);
    expect(candidates.some((a) => a.type === "attach_royal_support")).toBe(false);
    // The Royal is still offered as a new body in Court.
    expect(candidates.some((a) => a.type === "play_royal_to_court")).toBe(true);
    // And the engine itself rejects the attach if attempted directly.
    const attempt = dispatchAction(state, BOT, {
      type: "attach_royal_support",
      supportCardId: "KD",
      targetRoyalId: "JS",
    });
    expect(attempt.ok).toBe(false);
  });

  it("offers discard_diamond_for_boost while defending a duel with a frozen Vault", () => {
    const state = makeState({
      phase: "duel_blocker_turn",
      activePlayerId: P1,
      hasAttackedThisTurn: true,
      attacks: [
        { attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: BOT, blockerCardIds: ["JD"] },
      ],
      duelContext: {
        attackerPlayerId: P1,
        defenderPlayerId: BOT,
        duelAttackerPassed: false,
        duelBlockerPassed: false,
        attackerDiamondUsed: false,
        defenderDiamondUsed: false,
        resolvedPairAttackerIds: [],
      },
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KS", { hasAttackedThisTurn: true })] }),
        [BOT]: makePlayer(BOT, {
          hand: ["3D"],
          court: [mkRoyal("JD")],
          vault: { tempBoost: 0, spent: 0, frozenMineTotal: 5 },
        }),
      },
    });
    const candidates = enumerateCandidateActions(state, BOT);
    const boost = candidates.find(
      (a) => a.type === "discard_diamond_for_boost" && a.cardId === "3D",
    );
    expect(boost, "discard_diamond_for_boost should be enumerated in a duel").toBeDefined();
    expect(dispatchAction(state, BOT, boost!).ok).toBe(true);
  });

  it("reclaims a high non-Royal from the Abyss when no Royal/Joker is available", () => {
    // 8♥ (potential 4) and a 2♦ decoy (potential 1) in the Abyss, no Royal/Joker;
    // an affordable 8♠ in hand. The reclaim must exist and prefer the 8♥.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["3C"],
      abyss: ["8H", "2D"],
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { hand: ["8S"], court: [mkRoyal("KS")] }),
      },
    });
    const candidates = enumerateCandidateActions(state, BOT);
    const reclaim = candidates.find(
      (a) => a.type === "discard_spade_to_return" && a.spadeCardId === "8S",
    );
    expect(reclaim, "discard_spade_to_return should be enumerated").toBeDefined();
    if (reclaim && reclaim.type === "discard_spade_to_return") {
      expect(reclaim.targetCardId).toBe("8H");
      expect(dispatchAction(state, BOT, reclaim).ok).toBe(true);
    }
  });
});

describe("survival urgency — heals when the board threatens lethal", () => {
  // Fixed persona + near-zero temperature ≈ argmax, so these choices are
  // deterministic regardless of which archetype a match id would hash to.
  const sharp = {
    name: "test-sharp",
    selfLife: 1,
    aggression: 1,
    board: 1.2,
    oppBoard: 1,
    hand: 0.7,
    economy: 0.35,
    reserve: 0.9,
    temperature: 0.01,
  };
  const seeds = [1, 2, 3];

  const choose = (state: GameState, seed: number) =>
    chooseBotAction(state, BOT, { persona: sharp, rng: createRng(seed) });

  it("heals instead of ending the turn when the enemy board is lethal", () => {
    // Bot on 4 life facing K♥+Q♥ (⚔3 + ⚔2 = 5 incoming). Its only cards are a
    // 4♥ and plenty of Vault — healing is the difference between living and
    // dying, and previously the bot just ended the turn and died holding it.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C", "3C", "4C"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QH")], life: 20 }),
        [BOT]: makePlayer(BOT, { hand: ["4H"], court: [], life: 4 }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("discard_heart_to_heal");
      expect(dispatchAction(state, BOT, action).ok).toBe(true);
    }
  });

  it("does NOT panic-heal when it is not in danger", () => {
    // Identical board and Vault, but the bot is on 19 life — comfortably clear
    // of the 5 incoming. The survival term must be inert here: the bot should
    // develop (buff its Royal) or pressure (poke the opponent), NOT spend a
    // Heart to heal. We assert only "no defensive heal" — whether it buffs or
    // pokes is a matter of aggression, and both are fine when safe.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C", "3C", "4C"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QH")], life: 20 }),
        [BOT]: makePlayer(BOT, { hand: ["4H"], court: [mkRoyal("JS")], life: 19 }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).not.toBe("discard_heart_to_heal");
    }
  });

  it("flips to healing on the same board once life is lethal", () => {
    // Same state as above with the Heart-attach still available, only the life
    // total changed (19 -> 4). The survival term must now outweigh the buff.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C", "3C", "4C"],
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KH"), mkRoyal("QH")], life: 20 }),
        [BOT]: makePlayer(BOT, { hand: ["4H"], court: [mkRoyal("JS")], life: 4 }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("discard_heart_to_heal");
    }
  });

  it("still takes the lethal swing rather than healing", () => {
    // Bot on 2 life (K♥ untaps for 3 next turn, so it IS in danger) but its
    // K♠ can swing for exactly lethal into a tapped-out board that cannot
    // block. WIN_SCORE/ELIMINATION_BONUS must stay above the survival term.
    const state = makeState({
      phase: "main",
      activePlayerId: BOT,
      mine: ["10D"],
      deck: ["2C", "3C", "4C"],
      players: {
        [P1]: makePlayer(P1, {
          court: [mkRoyal("KH", { hasAttackedThisTurn: true })],
          life: 3,
        }),
        [BOT]: makePlayer(BOT, { hand: ["4H"], court: [mkRoyal("KS")], life: 2 }),
      },
    });
    for (const seed of seeds) {
      const action = choose(state, seed);
      expect(action.type, `seed ${seed} picked ${action.type}`).toBe("declare_attack");
    }
  });
});

describe("bot defends a lethal face-burn", () => {
  it("offers discard_heart_to_heal when the pending Club is lethal face damage", () => {
    // The window is open with a face-damage payload (no target Royal). The bot,
    // as defender, must be able to heal — otherwise it can only accept the hit.
    const state = makeState({
      phase: "respond_to_club",
      mine: ["10D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "6C",
        targetPlayerId: BOT,
        faceDamage: { sourceCardId: "6C", amount: 6 },
      },
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { life: 4, hand: ["5H", "2D"] }),
      },
    });
    const candidates = enumerateCandidateActions(state, BOT);
    const heal = candidates.find(
      (a) => a.type === "discard_heart_to_heal" && a.heartCardId === "5H",
    );
    expect(heal, "expected a discard_heart_to_heal candidate for 5H").toBeDefined();
    expect(candidates.some((a) => a.type === "confirm_club_response")).toBe(true);
  });

  // Regression for a real match (a427fd1d, turn 30, 2026-07-28): the human
  // played a lethal Joker at the bot's face and the bot answered with
  // confirm_club_response — accepting death — while holding 6H and AH with
  // ample Vault. 6H takes it to 16, eats the 10, and leaves it alive at 6.
  //
  // Offering the candidate is not enough; the SCORER has to prefer it. Dying
  // should settle to -WIN_SCORE and healing to a finite score, so this ought to
  // be a landslide. If it is not, the survival path is broken somewhere between
  // enumeration and sampleByScore.
  it("heals instead of accepting a survivable lethal face-burn", () => {
    const state = makeState({
      phase: "respond_to_club",
      activePlayerId: P1,
      turnNumber: 30,
      // 26 Vault available — the heal costs 6.
      mine: ["10D", "9D", "7D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "JOKER1",
        targetPlayerId: BOT,
        faceDamage: { sourceCardId: "JOKER1", amount: 10 },
      },
      players: {
        [P1]: makePlayer(P1, { life: 17, court: [mkRoyal("KH")] }),
        [BOT]: makePlayer(BOT, {
          life: 10,
          hand: ["10S", "5C", "AH", "6H", "3C", "8C"],
          court: [mkRoyal("JS"), mkRoyal("JH")],
        }),
      },
    });

    for (const seed of [1, 2, 3, 42, 1337]) {
      const action = chooseBotAction(state, BOT, { rng: createRng(seed) });
      expect(
        action.type,
        `seed ${seed}: bot accepted lethal instead of healing (picked ${JSON.stringify(action)})`,
      ).toBe("discard_heart_to_heal");
    }
  });

  it("survives the burn after healing", () => {
    // Guards the premise of the test above: 6H really is a save, so a bot that
    // confirms instead is misplaying rather than choosing between two deaths.
    const state = makeState({
      phase: "respond_to_club",
      activePlayerId: P1,
      mine: ["10D", "9D", "7D"],
      pendingClubDebuff: {
        attackerPlayerId: P1,
        clubCardId: "JOKER1",
        targetPlayerId: BOT,
        faceDamage: { sourceCardId: "JOKER1", amount: 10 },
      },
      players: {
        [P1]: makePlayer(P1),
        [BOT]: makePlayer(BOT, { life: 10, hand: ["6H"] }),
      },
    });

    const healed = dispatchAction(state, BOT, {
      type: "discard_heart_to_heal",
      heartCardId: "6H",
    });
    expect(healed.ok, healed.ok ? "" : healed.error).toBe(true);
    if (!healed.ok) return;
    expect(healed.value.players[BOT]!.life).toBe(16);

    const confirmed = dispatchAction(healed.value, BOT, { type: "confirm_club_response" });
    expect(confirmed.ok, confirmed.ok ? "" : confirmed.error).toBe(true);
    if (!confirmed.ok) return;
    expect(confirmed.value.players[BOT]!.life).toBe(6);
    expect(confirmed.value.players[BOT]!.isEliminated).toBe(false);
  });
});

describe("bot uses its Diamond action while blocking", () => {
  function blockingState(hand: string[], usedBy: string[] = []) {
    return makeState({
      phase: "declare_blocks",
      activePlayerId: P1,
      deck: ["2C", "3C"],
      attacks: [{ attackerPlayerId: P1, attackerCardId: "KS", targetPlayerId: BOT }],
      pendingBlockDefenders: [BOT],
      blockDiamondUsedBy: usedBy,
      players: {
        [P1]: makePlayer(P1, { court: [mkRoyal("KS", { hasAttackedThisTurn: true })] }),
        [BOT]: makePlayer(BOT, { hand, court: [mkRoyal("QH")] }),
      },
    });
  }

  it("offers draw and boost while blocking, alongside the block lines", () => {
    const candidates = enumerateCandidateActions(blockingState(["5D"]), BOT);
    expect(candidates.some((a) => a.type === "discard_diamond_to_draw")).toBe(true);
    expect(candidates.some((a) => a.type === "discard_diamond_for_boost")).toBe(true);
    expect(candidates.some((a) => a.type === "confirm_declare_blocks")).toBe(true);
    // Every candidate must be engine-legal.
    for (const action of candidates) {
      expect(
        dispatchAction(blockingState(["5D"]), BOT, action).ok,
        `${JSON.stringify(action)} was rejected`,
      ).toBe(true);
    }
  });

  it("stops offering it once the block-window Diamond is spent", () => {
    const candidates = enumerateCandidateActions(blockingState(["5D"], [BOT]), BOT);
    expect(candidates.some((a) => a.type.startsWith("discard_diamond"))).toBe(false);
  });

  it("keeps the block lines first, so settle-scoring's positional fallback is safe", () => {
    // bestDefenderBlocks falls back to options[0] (all-pass) / options[1]
    // (greedy) when its search budget runs out. A Diamond landing in either
    // slot would corrupt the modelled defender, so blocks must lead the list.
    const candidates = enumerateCandidateActions(blockingState(["5D"]), BOT);
    expect(candidates[0]?.type).toBe("confirm_declare_blocks");
    const firstDiamond = candidates.findIndex((a) => a.type.startsWith("discard_diamond"));
    const lastBlock = candidates.map((a) => a.type).lastIndexOf("confirm_declare_blocks");
    expect(firstDiamond).toBeGreaterThan(lastBlock);
  });
});
