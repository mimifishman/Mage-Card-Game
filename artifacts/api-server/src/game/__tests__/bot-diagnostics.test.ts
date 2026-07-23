import { describe, it, expect, vi } from "vitest";
import {
  chooseBotAction,
  chooseBotInterrupt,
  createRng,
  personaByName,
  PERSONA_NAMES,
  type BotPersona,
} from "../bot";
import { dispatchAction, getTurnHolderId } from "../dispatcher";
import { createInitialGameState, dealInitialHands, determineFirstPlayer } from "../setup";
import { isGameOver, getWinner } from "../turn";
import { effectiveAttack, effectiveHealth, getCard } from "../cards";
import { availableVault } from "../vault";
import type { GameAction } from "../actions";
import type { CardId, GameState, PlayerState } from "../types";

/**
 * Bot DIAGNOSTICS harness — an investigation tool, not a CI gate.
 *
 * bot-simulation.test.ts proves games terminate and tracks one regression
 * metric. This file exists to FIND new misplays without hand-playing games and
 * reading the production action log. It differs in five ways:
 *
 *  1. Cross-persona play. chooseBotAction falls back to personaForMatch when no
 *     persona is passed, so the other harness only ever plays mirror matches.
 *     Here each seat gets an explicit persona, so all 9 pairings are covered.
 *  2. Interrupts. It mirrors bot/runner.ts (max 2 per player per game turn,
 *     only after an opponent has acted this turn), exercising chooseBotInterrupt
 *     and INTERRUPT_MIN_GAIN — otherwise entirely unsimulated.
 *  3. Ten misplay detectors instead of one.
 *  4. 3-player games, where the single-lowest-life declare_attack targeting in
 *     mainPhaseCandidates stops being dormant.
 *  5. Per-game seeding, so any flagged game is replayable from its index alone.
 *
 * Detectors are heuristics: a hit is a SUSPICION to investigate, not a proven
 * bug. Confirmed findings get promoted into bot.test.ts as real assertions.
 *
 * Skipped unless BOT_DIAG=1, so it never slows the normal suite:
 *   BOT_DIAG=1 pnpm --filter @workspace/api-server test bot-diagnostics
 */

const RUN = process.env.BOT_DIAG === "1";

const GAMES_PER_PAIRING = 20;
const GAMES_3P = 30;
const MAX_ACTIONS = 3000;
const BASE_SEED = 987654321;
/** Same per-turn interrupt budget the live runner enforces. */
const MAX_INTERRUPTS_PER_TURN = 2;
/** Vault at end_turn at or above which sitting on affordable cards looks like hoarding. */
const WASTED_VAULT_FLOOR = 5;
const SAMPLE_LIMIT = 5;

const P1 = "player-1";
const P2 = "player-2";
const P3 = "player-3";

interface DetectorStat {
  hits: number;
  /** Opportunities the detector could have fired on, for a meaningful rate. */
  opportunities: number;
  samples: string[];
}

function newDetector(): DetectorStat {
  return { hits: 0, opportunities: 0, samples: [] };
}

function record(stat: DetectorStat, hit: boolean, sample: () => string): void {
  stat.opportunities++;
  if (!hit) return;
  stat.hits++;
  if (stat.samples.length < SAMPLE_LIMIT) stat.samples.push(sample());
}

function rate(stat: DetectorStat): string {
  if (stat.opportunities === 0) return "n/a";
  return `${stat.hits}/${stat.opportunities} (${((stat.hits / stat.opportunities) * 100).toFixed(1)}%)`;
}

interface Diagnostics {
  games: number;
  finished: number;
  stalemates: number;
  totalActions: number;
  actionCounts: Record<string, number>;
  jokerModes: Record<string, number>;
  /** playerPersona -> wins */
  wins: Record<string, number>;
  /** "attacker-persona vs defender-persona" -> [wins, losses] */
  pairings: Record<string, { w: number; l: number; draw: number }>;
  interruptAttempts: number;
  interruptFired: number;
  interruptActions: Record<string, number>;
  detectors: {
    missedLethal: DetectorStat;
    passivity: DetectorStat;
    wastedVault: DetectorStat;
    idleDiamond: DetectorStat;
    missedFreeBlock: DetectorStat;
    badDiscard: DetectorStat;
    deathHoldingHeart: DetectorStat;
    nonLowestTarget: DetectorStat;
    splitAttack: DetectorStat;
  };
  /** Detector hits attributed to the persona of the player who acted. */
  perPersona: Record<string, Record<string, number>>;
}

function newDiagnostics(): Diagnostics {
  return {
    games: 0,
    finished: 0,
    stalemates: 0,
    totalActions: 0,
    actionCounts: {},
    jokerModes: {},
    wins: {},
    pairings: {},
    interruptAttempts: 0,
    interruptFired: 0,
    interruptActions: {},
    detectors: {
      missedLethal: newDetector(),
      passivity: newDetector(),
      wastedVault: newDetector(),
      idleDiamond: newDetector(),
      missedFreeBlock: newDetector(),
      badDiscard: newDetector(),
      deathHoldingHeart: newDetector(),
      nonLowestTarget: newDetector(),
      splitAttack: newDetector(),
    },
    perPersona: {},
  };
}

function bump(diag: Diagnostics, persona: string, key: string): void {
  if (!diag.perPersona[persona]) diag.perPersona[persona] = {};
  const row = diag.perPersona[persona]!;
  row[key] = (row[key] ?? 0) + 1;
}

// --- shared predicates -----------------------------------------------------

function livingOpponents(state: GameState, playerId: string): PlayerState[] {
  return state.turnOrder
    .filter((id) => id !== playerId && !state.players[id]?.isEliminated)
    .map((id) => state.players[id]!)
    .filter(Boolean);
}

/** Royals that could legally be declared as attackers right now. */
function attackReadyRoyals(player: PlayerState) {
  return player.court.filter((r) => !r.hasteLocked && !r.hasAttackedThisTurn);
}

/** Non-Royal Hearts this player could afford to play right now. */
function affordableHearts(state: GameState, player: PlayerState): CardId[] {
  const vault = availableVault(state.mine, player);
  return player.hand.filter((cardId) => {
    const card = getCard(cardId);
    return card.suit === "H" && !card.isRoyal && card.vaultCost <= vault;
  });
}

/** Anything in hand the player could pay for right now. */
function affordableCards(state: GameState, player: PlayerState): CardId[] {
  const vault = availableVault(state.mine, player);
  return player.hand.filter((cardId) => getCard(cardId).vaultCost <= vault);
}

function handHasUnusedDiamond(player: PlayerState): boolean {
  return (
    !player.hasPlayedDiamondThisTurn &&
    player.hand.some((c) => {
      const card = getCard(c);
      return card.suit === "D" && !card.isRoyal;
    })
  );
}

// --- detectors -------------------------------------------------------------

/**
 * D1 — a swing that reaches an opponent's remaining life was available and the
 * bot did something else. Heuristic: blockers may still save the opponent, so
 * a hit is a lead, not proof. A high rate points at settleForScoring's
 * assumption that the defender always greedy-blocks, which discounts attacks.
 */
function checkMissedLethal(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (state.phase !== "main" && state.phase !== "declare_attacks") return;
  if (state.hasAttackedThisTurn) return;
  const me = state.players[playerId];
  if (!me) return;
  const ready = attackReadyRoyals(me);
  if (ready.length === 0) return;
  const swing = ready.reduce((sum, r) => sum + effectiveAttack(r), 0);
  const opponents = livingOpponents(state, playerId);
  const killable = opponents.filter((o) => o.life <= swing);
  if (killable.length === 0) return;

  record(diag.detectors.missedLethal, action.type !== "declare_attack", () => {
    const target = killable[0]!;
    return `${gameLabel} ${persona}: swing ${swing} vs ${target.id} life ${target.life}, played ${action.type}`;
  });
  if (action.type !== "declare_attack") bump(diag, persona, "missedLethal");
}

/**
 * D2 — ended the turn with attackers available and never swung. Quantifies the
 * "aggressor is the least aggressive persona" finding from the live logs.
 */
function checkPassivity(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "end_turn") return;
  const me = state.players[playerId];
  if (!me) return;
  if (livingOpponents(state, playerId).length === 0) return;
  const ready = attackReadyRoyals(me);
  if (ready.length === 0) return;

  record(diag.detectors.passivity, !state.hasAttackedThisTurn, () => {
    const swing = ready.reduce((sum, r) => sum + effectiveAttack(r), 0);
    return `${gameLabel} ${persona}: ended turn ${state.turnNumber} holding ${ready.length} ready Royal(s) (${swing} atk), never attacked`;
  });
  if (!state.hasAttackedThisTurn) bump(diag, persona, "passivity");
}

/**
 * D3 — ended the turn sitting on Vault with affordable cards in hand. The
 * economy + reserve terms (reserve capped at RESERVE_CAP) can make hoarding
 * score better than developing.
 */
function checkWastedVault(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "end_turn") return;
  const me = state.players[playerId];
  if (!me) return;
  const vault = availableVault(state.mine, me);
  const affordable = affordableCards(state, me);
  const hit = vault >= WASTED_VAULT_FLOOR && affordable.length > 0;

  record(diag.detectors.wastedVault, hit, () =>
    `${gameLabel} ${persona}: ended turn ${state.turnNumber} with vault ${vault}, could afford ${affordable.join("/")}`,
  );
  if (hit) bump(diag, persona, "wastedVault");
}

/** D4 — the free once-per-turn Diamond action went unused. Pure lost tempo. */
function checkIdleDiamond(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "end_turn") return;
  const me = state.players[playerId];
  if (!me) return;
  const hit = handHasUnusedDiamond(me);

  record(diag.detectors.idleDiamond, hit, () =>
    `${gameLabel} ${persona}: ended turn ${state.turnNumber} without using its Diamond action`,
  );
  if (hit) bump(diag, persona, "idleDiamond");
}

/**
 * D5 — passed an attacker that a free blocker would have killed while
 * surviving: a strictly free trade. The live logs showed most blocks are
 * all-pass, so this puts a number on it.
 */
function checkMissedFreeBlock(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "confirm_declare_blocks") return;
  const me = state.players[playerId];
  if (!me) return;

  const committed = new Set<CardId>();
  for (const assigned of Object.values(action.blocks)) {
    if (assigned !== "pass") for (const id of assigned) committed.add(id);
  }

  for (const attack of state.attacks) {
    if (attack.targetPlayerId !== playerId) continue;
    if (action.blocks[attack.attackerCardId] !== "pass") continue;
    const attacker = state.players[attack.attackerPlayerId]?.court.find(
      (r) => r.cardId === attack.attackerCardId,
    );
    if (!attacker) continue;
    const atkAttack = effectiveAttack(attacker);
    const atkHealth = effectiveHealth(attacker);
    const freeKiller = me.court.find(
      (b) =>
        !committed.has(b.cardId) &&
        !b.hasAttackedThisTurn &&
        effectiveAttack(b) >= atkHealth &&
        effectiveHealth(b) > atkAttack,
    );

    record(diag.detectors.missedFreeBlock, Boolean(freeKiller), () =>
      `${gameLabel} ${persona}: passed ${attack.attackerCardId} (${atkAttack}/${atkHealth}) with ${freeKiller!.cardId} able to kill it and live`,
    );
    if (freeKiller) bump(diag, persona, "missedFreeBlock");
  }
}

/** D6 — threw away a Royal or Joker at cleanup while pip cards were in hand. */
function checkBadDiscard(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "discard_to_end_turn") return;
  const me = state.players[playerId];
  if (!me) return;
  const discarded = getCard(action.cardId);
  const hasCheaper = me.hand.some((c) => {
    const card = getCard(c);
    return !card.isRoyal && !card.isJoker;
  });
  const hit = (discarded.isRoyal || discarded.isJoker) && hasCheaper;

  record(diag.detectors.badDiscard, hit, () =>
    `${gameLabel} ${persona}: discarded ${action.cardId} while holding ${me.hand.join("/")}`,
  );
  if (hit) bump(diag, persona, "badDiscard");
}

/**
 * D10 — multiplayer targeting. mainPhaseCandidates only ever builds one target
 * group aimed at the lowest-life opponent, so both of these should read 0 at
 * 3p; the point is to size the gap.
 */
function checkAttackTargeting(
  diag: Diagnostics,
  state: GameState,
  playerId: string,
  persona: string,
  action: GameAction,
  gameLabel: string,
): void {
  if (action.type !== "declare_attack") return;
  const opponents = livingOpponents(state, playerId);
  if (opponents.length < 2) return;

  const lowest = [...opponents].sort((a, b) => a.life - b.life)[0]!;
  const splits = action.targets.length > 1;
  record(diag.detectors.splitAttack, splits, () =>
    `${gameLabel} ${persona}: split attack across ${action.targets.length} opponents`,
  );

  const aimedElsewhere = action.targets.some((t) => t.targetPlayerId !== lowest.id);
  record(diag.detectors.nonLowestTarget, aimedElsewhere, () =>
    `${gameLabel} ${persona}: attacked a non-lowest-life opponent`,
  );
  if (aimedElsewhere) bump(diag, persona, "nonLowestTarget");
}

// --- game loop -------------------------------------------------------------

interface GameOutcome {
  finished: boolean;
  stalemate: boolean;
  winner: string | null;
}

function playGame(
  diag: Diagnostics,
  gameIndex: number,
  matchId: string,
  seats: string[],
  personas: Record<string, BotPersona>,
): GameOutcome {
  const gameLabel = `[${matchId}]`;
  // Offset from the Math.random seed (createRng(BASE_SEED + gameIndex), set by
  // the caller) so the bot's sampling stream isn't identical to the shuffler's.
  const rng = createRng(BASE_SEED + gameIndex * 7919 + 13);

  const init = createInitialGameState(matchId, seats);
  expect(init.ok, `setup failed: ${init.ok ? "" : init.error}`).toBe(true);
  if (!init.ok) return { finished: false, stalemate: true, winner: null };
  const withFirst = determineFirstPlayer(init.value);
  if (!withFirst.ok) return { finished: false, stalemate: true, winner: null };
  const dealt = dealInitialHands(withFirst.value);
  if (!dealt.ok) return { finished: false, stalemate: true, winner: null };

  let state = dealt.value;
  let actions = 0;
  let stalemate = false;
  /** playerId -> { turn, used } — mirrors runner.ts's per-turn interrupt budget. */
  const interruptBudget: Record<string, { turn: number; used: number }> = {};
  /** Players who have acted during the current game turn (runner's markHumanActivity). */
  let actedThisTurn = new Set<string>();
  let currentTurn = state.turnNumber;

  while (!isGameOver(state) && actions < MAX_ACTIONS) {
    const holderId = getTurnHolderId(state);
    if (!holderId) break;
    const persona = personas[holderId]!;

    const prev = state;
    const action = chooseBotAction(state, holderId, { persona, rng });

    checkMissedLethal(diag, state, holderId, persona.name, action, gameLabel);
    checkPassivity(diag, state, holderId, persona.name, action, gameLabel);
    checkWastedVault(diag, state, holderId, persona.name, action, gameLabel);
    checkIdleDiamond(diag, state, holderId, persona.name, action, gameLabel);
    checkMissedFreeBlock(diag, state, holderId, persona.name, action, gameLabel);
    checkBadDiscard(diag, state, holderId, persona.name, action, gameLabel);
    checkAttackTargeting(diag, state, holderId, persona.name, action, gameLabel);

    const result = dispatchAction(state, holderId, action);
    if (!result.ok) {
      // Running the deck out is a stalemate, not a bot bug — same tolerance as
      // the deadlock canary. Anything else is a real defect.
      expect(
        result.error,
        `${gameLabel} ${JSON.stringify(action)} rejected in ${state.phase}: ${result.error}`,
      ).toMatch(/no cards to draw/i);
      stalemate = true;
      break;
    }

    diag.actionCounts[action.type] = (diag.actionCounts[action.type] ?? 0) + 1;
    if (action.type === "play_joker") {
      diag.jokerModes[action.mode] = (diag.jokerModes[action.mode] ?? 0) + 1;
    }
    state = result.value;
    actions++;

    if (state.turnNumber !== currentTurn) {
      currentTurn = state.turnNumber;
      actedThisTurn = new Set<string>();
    }
    actedThisTurn.add(holderId);

    recordDeaths(diag, prev, state, personas, gameLabel);

    // --- interrupts, mirroring bot/runner.ts's tryBotInterrupt -------------
    for (const id of state.turnOrder) {
      if (isGameOver(state)) break;
      if (id === getTurnHolderId(state)) continue;
      const player = state.players[id];
      if (!player || player.isEliminated) continue;
      // React to plays, not to the clock: someone else must have acted first.
      if (![...actedThisTurn].some((actor) => actor !== id)) continue;

      const budget = interruptBudget[id];
      const used = budget && budget.turn === state.turnNumber ? budget.used : 0;
      if (used >= MAX_INTERRUPTS_PER_TURN) continue;

      diag.interruptAttempts++;
      const interrupt = chooseBotInterrupt(state, id, { persona: personas[id]!, rng });
      if (!interrupt) continue;

      const before = state;
      const res = dispatchAction(state, id, interrupt);
      if (!res.ok) continue;

      diag.interruptFired++;
      diag.interruptActions[interrupt.type] = (diag.interruptActions[interrupt.type] ?? 0) + 1;
      diag.actionCounts[interrupt.type] = (diag.actionCounts[interrupt.type] ?? 0) + 1;
      interruptBudget[id] = { turn: state.turnNumber, used: used + 1 };
      state = res.value;
      actions++;
      recordDeaths(diag, before, state, personas, gameLabel);
    }
  }

  diag.totalActions += actions;
  if (stalemate) return { finished: false, stalemate: true, winner: null };
  if (isGameOver(state)) return { finished: true, stalemate: false, winner: getWinner(state) ?? null };
  // Hit the action cap without resolving — counted as a stalemate so the
  // termination assertion still balances, and visible via avg actions/game.
  return { finished: false, stalemate: true, winner: null };
}

/**
 * D8 — anyone eliminated by the action that produced `after` is inspected in
 * `before`, while still alive, for a Heart they had the Vault to play.
 */
function recordDeaths(
  diag: Diagnostics,
  before: GameState,
  after: GameState,
  personas: Record<string, BotPersona>,
  gameLabel: string,
): void {
  for (const id of after.turnOrder) {
    const wasAlive = before.players[id];
    const nowDead = after.players[id];
    if (!wasAlive || !nowDead) continue;
    if (wasAlive.isEliminated || !nowDead.isEliminated) continue;

    const hearts = affordableHearts(before, wasAlive);
    const persona = personas[id]?.name ?? "unknown";
    record(diag.detectors.deathHoldingHeart, hearts.length > 0, () =>
      `${gameLabel} ${persona}: died at ${wasAlive.life} life holding ${hearts.join("/")}`,
    );
    if (hearts.length > 0) bump(diag, persona, "deathHoldingHeart");
  }
}

// --- reporting -------------------------------------------------------------

function formatReport(title: string, diag: Diagnostics): string {
  const lines: string[] = ["", `=== ${title} ===`];
  lines.push(
    `games ${diag.games}  finished ${diag.finished}  stalemates ${diag.stalemates}  avg actions/game ${(
      diag.totalActions / Math.max(diag.games, 1)
    ).toFixed(1)}`,
  );

  const pairings = Object.entries(diag.pairings).sort(([a], [b]) => a.localeCompare(b));
  if (pairings.length > 0) {
    lines.push("matchups (seat1 persona vs seat2 persona → seat1 W-L-draw):");
    for (const [key, r] of pairings) lines.push(`  ${key}: ${r.w}-${r.l}-${r.draw}`);
  }

  const wins = Object.entries(diag.wins).sort((a, b) => b[1] - a[1]);
  if (wins.length > 0) {
    lines.push("wins by persona: " + wins.map(([p, n]) => `${p}=${n}`).join(" "));
  }

  lines.push("");
  lines.push("detectors (hits/opportunities):");
  const d = diag.detectors;
  lines.push(`  D1 missed lethal      ${rate(d.missedLethal)}`);
  lines.push(`  D2 passive turn       ${rate(d.passivity)}`);
  lines.push(`  D3 wasted vault       ${rate(d.wastedVault)}`);
  lines.push(`  D4 idle diamond       ${rate(d.idleDiamond)}`);
  lines.push(`  D5 missed free block  ${rate(d.missedFreeBlock)}`);
  lines.push(`  D6 bad discard        ${rate(d.badDiscard)}`);
  lines.push(`  D8 died with a Heart  ${rate(d.deathHoldingHeart)}`);
  lines.push(`  D10 non-lowest target ${rate(d.nonLowestTarget)}`);
  lines.push(`  D10 split attack      ${rate(d.splitAttack)}`);

  lines.push("");
  lines.push(
    `D9 interrupts: attempts ${diag.interruptAttempts}  fired ${diag.interruptFired} (${(
      (diag.interruptFired / Math.max(diag.interruptAttempts, 1)) *
      100
    ).toFixed(1)}%)  ` +
      (Object.keys(diag.interruptActions).length > 0
        ? Object.entries(diag.interruptActions)
            .sort((a, b) => b[1] - a[1])
            .map(([t, n]) => `${t}=${n}`)
            .join(" ")
        : "(none)"),
  );

  lines.push("");
  lines.push("D7 feature usage:");
  for (const key of [
    "attach_royal_support",
    "discard_spade_to_return",
    "discard_diamond_for_boost",
    "discard_heart_to_heal",
    "declare_attack",
    "play_joker",
  ]) {
    lines.push(`  ${key.padEnd(26)} ${diag.actionCounts[key] ?? 0}`);
  }
  if (Object.keys(diag.jokerModes).length > 0) {
    lines.push(
      "  joker modes: " +
        Object.entries(diag.jokerModes)
          .map(([m, n]) => `${m}=${n}`)
          .join(" "),
    );
  }

  lines.push("");
  lines.push("detector hits by persona (all three share one candidate generator,");
  lines.push("so a hit on ONE persona points at its weights, on ALL THREE at the generator):");
  for (const name of PERSONA_NAMES) {
    const row = diag.perPersona[name];
    lines.push(
      `  ${name.padEnd(11)} ` +
        (row
          ? Object.entries(row)
              .sort((a, b) => b[1] - a[1])
              .map(([k, n]) => `${k}=${n}`)
              .join(" ")
          : "(no hits)"),
    );
  }

  lines.push("");
  lines.push("full action mix:");
  lines.push(
    "  " +
      Object.entries(diag.actionCounts)
        .sort((a, b) => b[1] - a[1])
        .map(([t, n]) => `${t}=${n}`)
        .join(" "),
  );

  const sampleSections: Array<[string, DetectorStat]> = [
    ["D1 missed lethal", d.missedLethal],
    ["D2 passive turn", d.passivity],
    ["D3 wasted vault", d.wastedVault],
    ["D4 idle diamond", d.idleDiamond],
    ["D5 missed free block", d.missedFreeBlock],
    ["D6 bad discard", d.badDiscard],
    ["D8 died with a Heart", d.deathHoldingHeart],
  ];
  const withSamples = sampleSections.filter(([, s]) => s.samples.length > 0);
  if (withSamples.length > 0) {
    lines.push("");
    lines.push("samples:");
    for (const [label, stat] of withSamples) {
      lines.push(`  ${label}:`);
      for (const sample of stat.samples) lines.push(`    ${sample}`);
    }
  }

  lines.push("");
  return lines.join("\n");
}

// --- suites ----------------------------------------------------------------

describe.skipIf(!RUN)("bot diagnostics", () => {
  it(
    `round robin: every persona pairing, ${GAMES_PER_PAIRING} games each`,
    () => {
      const diag = newDiagnostics();
      let gameIndex = 0;

      for (const p1Name of PERSONA_NAMES) {
        for (const p2Name of PERSONA_NAMES) {
          const personas: Record<string, BotPersona> = {
            [P1]: personaByName(p1Name)!,
            [P2]: personaByName(p2Name)!,
          };
          const key = `${p1Name} vs ${p2Name}`;
          diag.pairings[key] = { w: 0, l: 0, draw: 0 };

          for (let g = 0; g < GAMES_PER_PAIRING; g++) {
            // Re-seed Math.random PER GAME (deck shuffling in cards.ts uses it),
            // so a flagged game can be replayed from its index alone rather
            // than by re-running everything before it.
            const spy = vi.spyOn(Math, "random").mockImplementation(createRng(BASE_SEED + gameIndex));
            try {
              const outcome = playGame(
                diag,
                gameIndex,
                `diag-2p-${gameIndex}`,
                [P1, P2],
                personas,
              );
              diag.games++;
              if (outcome.finished) {
                diag.finished++;
                const winnerPersona = outcome.winner ? personas[outcome.winner]?.name : undefined;
                if (winnerPersona) diag.wins[winnerPersona] = (diag.wins[winnerPersona] ?? 0) + 1;
                if (outcome.winner === P1) diag.pairings[key]!.w++;
                else if (outcome.winner === P2) diag.pairings[key]!.l++;
                else diag.pairings[key]!.draw++;
              } else {
                diag.stalemates++;
              }
            } finally {
              spy.mockRestore();
            }
            gameIndex++;
          }
        }
      }

      // eslint-disable-next-line no-console
      console.log(formatReport("2-player round robin", diag));

      // The only hard gate: every game must resolve one way or the other.
      expect(diag.finished + diag.stalemates).toBe(diag.games);
      expect(diag.games).toBe(PERSONA_NAMES.length * PERSONA_NAMES.length * GAMES_PER_PAIRING);
    },
    600_000,
  );

  it(
    `three-player games (${GAMES_3P}) — multiplayer targeting`,
    () => {
      const diag = newDiagnostics();
      const personas: Record<string, BotPersona> = {
        [P1]: personaByName("aggressor")!,
        [P2]: personaByName("controller")!,
        [P3]: personaByName("economist")!,
      };

      for (let g = 0; g < GAMES_3P; g++) {
        const spy = vi.spyOn(Math, "random").mockImplementation(createRng(BASE_SEED + 10_000 + g));
        try {
          const outcome = playGame(diag, 10_000 + g, `diag-3p-${g}`, [P1, P2, P3], personas);
          diag.games++;
          if (outcome.finished) {
            diag.finished++;
            const winnerPersona = outcome.winner ? personas[outcome.winner]?.name : undefined;
            if (winnerPersona) diag.wins[winnerPersona] = (diag.wins[winnerPersona] ?? 0) + 1;
          } else {
            diag.stalemates++;
          }
        } finally {
          spy.mockRestore();
        }
      }

      // eslint-disable-next-line no-console
      console.log(formatReport("3-player games", diag));

      expect(diag.finished + diag.stalemates).toBe(diag.games);
      expect(diag.games).toBe(GAMES_3P);
    },
    600_000,
  );
});
