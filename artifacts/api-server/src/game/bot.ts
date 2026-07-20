import { effectiveAttack, effectiveHealth, getCard } from "./cards";
import type { GameAction } from "./actions";
import type { CardId, GameState, PlayerState, TurnPhase } from "./types";
import { availableVault } from "./vault";
import { dispatchAction, getTurnHolderId } from "./dispatcher";
import { isGameOver, getWinner } from "./turn";

/**
 * Rule-based AI opponent ("AI Mage").
 *
 * Pure decision layer on top of the engine: enumerate candidate actions for
 * the phase where the bot holds priority, run each through dispatchAction as
 * a one-ply lookahead (the engine itself is the legality oracle), score the
 * resulting states with persona-weighted heuristics, and sample from a
 * softmax over the scores so play varies between games without being random.
 *
 * Invariant: every phase's candidate set includes a guaranteed-legal terminal
 * action (see fallbackAction), so the bot can never deadlock a match.
 */

export interface BotPersona {
  name: string;
  /** Weight on the bot's own life total. */
  selfLife: number;
  /** Weight on damage dealt / opponents' (negated) life totals. */
  aggression: number;
  /** Weight on the bot's own court strength. */
  board: number;
  /** Weight on (negated) opponent court strength — board control. */
  oppBoard: number;
  /** Weight on cards in hand. */
  hand: number;
  /** Weight on available Vault. */
  economy: number;
  /**
   * Weight on KEEPING Vault unspent (capped at RESERVE_CAP) — interrupt money
   * for reacting during opponents' turns, when Vault is frozen and whatever
   * was spent stays spent until the bot's next turn.
   */
  reserve: number;
  /** Softmax temperature: higher = more erratic, lower = sharper. */
  temperature: number;
}

const PERSONAS: BotPersona[] = [
  {
    name: "aggressor",
    selfLife: 0.8,
    aggression: 1.6,
    board: 0.9,
    oppBoard: 0.9,
    hand: 0.5,
    economy: 0.25,
    reserve: 0.5,
    temperature: 0.9,
  },
  {
    name: "controller",
    selfLife: 1.2,
    aggression: 0.9,
    board: 1.1,
    oppBoard: 1.5,
    hand: 0.7,
    economy: 0.35,
    reserve: 0.9,
    temperature: 0.8,
  },
  {
    name: "economist",
    selfLife: 1.0,
    aggression: 1.0,
    board: 1.0,
    oppBoard: 1.0,
    hand: 0.9,
    economy: 0.6,
    reserve: 1.1,
    temperature: 1.0,
  },
];

/** Deterministic 32-bit hash (FNV-1a) so persona choice is stable per match. */
function hashString(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Seeded PRNG (mulberry32) for reproducible sampling in tests. */
export function createRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Persona is derived from the match id, so the bot plays one consistent
 * personality per game (stable across server restarts) but a different one
 * from game to game.
 */
export function personaForMatch(matchId: string): BotPersona {
  return PERSONAS[hashString(matchId) % PERSONAS.length]!;
}

function courtValue(player: PlayerState): number {
  return player.court.reduce(
    (sum, r) => sum + effectiveAttack(r) + Math.max(0, effectiveHealth(r)),
    0,
  );
}

/**
 * Rough usefulness of holding a card, so discard decisions (and card spends)
 * distinguish a King from a 2 instead of just counting cards.
 */
function cardPotential(cardId: CardId): number {
  const card = getCard(cardId);
  if (card.isJoker) return 8;
  if (card.isRoyal) return 3 + card.pipValue; // J=4, Q=5, K=6
  return card.pipValue * 0.5;
}

function handValue(player: PlayerState): number {
  return player.hand.reduce((sum, c) => sum + cardPotential(c), 0);
}

const WIN_SCORE = 1_000_000;
const ELIMINATION_BONUS = 300;
/** Vault kept unspent counts toward the score only up to this much. */
const RESERVE_CAP = 5;

function evaluateState(state: GameState, botId: string, persona: BotPersona): number {
  const me = state.players[botId];
  if (!me || me.isEliminated) return -WIN_SCORE;
  if (isGameOver(state) && getWinner(state) === botId) return WIN_SCORE;

  let score = 0;
  score += persona.selfLife * me.life;
  score += persona.board * courtValue(me);
  score += persona.hand * 0.5 * handValue(me);
  score += persona.economy * availableVault(state.mine, me);

  // Interrupt money: value keeping a little Vault unspent (it is frozen and
  // unrecoverable during opponents' turns). Worth less when the bot holds no
  // reactive cards to spend it on.
  const holdsReactiveCards = me.hand.some((c) => {
    const card = getCard(c);
    return !card.isRoyal && (card.suit === "H" || card.suit === "S" || card.suit === "C");
  });
  score +=
    persona.reserve *
    (holdsReactiveCards ? 1 : 0.5) *
    Math.min(Math.max(availableVault(state.mine, me), 0), RESERVE_CAP);

  let anyOpponentBoard = false;
  for (const id of state.turnOrder) {
    if (id === botId) continue;
    const opp = state.players[id];
    if (!opp) continue;
    if (opp.isEliminated) {
      score += ELIMINATION_BONUS;
      continue;
    }
    if (opp.court.length > 0) anyOpponentBoard = true;
    score -= persona.aggression * opp.life;
    score -= persona.oppBoard * courtValue(opp);
  }

  // Defensive readiness: untapped Royals can block next turn. Only matters
  // while an opponent has a board to attack with.
  if (anyOpponentBoard) {
    const untapped = me.court.filter((r) => !r.hasAttackedThisTurn).length;
    score += persona.board * 0.25 * untapped;
  }

  // Board access: with an empty court, holding at least one Royal is the only
  // path back onto the board. A flat bonus for having that access makes Abyss
  // reclaims (no Royal → a Royal) win scoring exactly when rebuilding
  // matters, while leaving the play-the-Royal decision undistorted (playing
  // it keeps access via the court, so the bonus doesn't move).
  if (me.court.length === 0 && me.hand.some((c) => getCard(c).isRoyal)) {
    score += persona.board * 3;
  }

  return score;
}

function nonEliminatedOpponents(state: GameState, botId: string): PlayerState[] {
  return state.turnOrder
    .filter((id) => id !== botId && !state.players[id]?.isEliminated)
    .map((id) => state.players[id]!)
    .filter(Boolean);
}

function botIncomingAttacks(state: GameState, botId: string) {
  return state.attacks.filter((a) => a.targetPlayerId === botId);
}

/**
 * The guaranteed-legal terminal action for whatever phase the bot holds
 * priority in. Used as the last-resort candidate and by the runner as a
 * defense-in-depth retry if a chosen action is unexpectedly rejected.
 */
export function fallbackAction(state: GameState, botId: string): GameAction {
  switch (state.phase) {
    case "discard": {
      const hand = state.players[botId]?.hand ?? [];
      const nonRoyals = hand.filter((c) => !getCard(c).isRoyal);
      const pool = nonRoyals.length > 0 ? nonRoyals : hand;
      const lowest = [...pool].sort((a, b) => getCard(a).pipValue - getCard(b).pipValue)[0];
      return { type: "discard_to_end_turn", cardId: lowest ?? hand[0] ?? "" };
    }
    case "declare_blocks": {
      const blocks: Record<string, "pass"> = {};
      for (const attack of botIncomingAttacks(state, botId)) {
        blocks[attack.attackerCardId] = "pass";
      }
      return { type: "confirm_declare_blocks", blocks };
    }
    case "assign_damage_order": {
      const assignments: Record<string, string[]> = {};
      const defenderId = state.duelContext?.defenderPlayerId;
      for (const attack of state.attacks) {
        if (attack.targetPlayerId !== defenderId) continue;
        if (attack.blockerCardIds && attack.blockerCardIds.length > 1) {
          assignments[attack.attackerCardId] = [...attack.blockerCardIds];
        }
      }
      return { type: "set_damage_order", assignments };
    }
    case "duel_attacker_turn":
    case "duel_blocker_turn":
      return { type: "duel_pass" };
    case "respond_to_club":
      return { type: "confirm_club_response" };
    default:
      return { type: "end_turn" };
  }
}

function mainPhaseCandidates(state: GameState, botId: string): GameAction[] {
  const me = state.players[botId];
  if (!me) return [];
  const candidates: GameAction[] = [];
  const vault = availableVault(state.mine, me);
  const opponents = nonEliminatedOpponents(state, botId);

  for (const cardId of me.hand) {
    const card = getCard(cardId);

    if (card.suit === "D" && !card.isRoyal && !me.hasPlayedDiamondThisTurn) {
      candidates.push({ type: "play_diamond_to_mine", cardId });
      candidates.push({ type: "discard_diamond_to_draw", cardId });
    }

    if (card.isRoyal && card.vaultCost <= vault) {
      candidates.push({ type: "play_royal_to_court", cardId });
    }

    if (card.suit === "H" && !card.isRoyal && card.vaultCost <= vault) {
      for (const royal of me.court) {
        candidates.push({ type: "attach_heart", heartCardId: cardId, targetRoyalId: royal.cardId });
      }
      if (me.life < 20) {
        candidates.push({ type: "discard_heart_to_heal", heartCardId: cardId });
      }
    }

    if (card.suit === "S" && !card.isRoyal && card.vaultCost <= vault) {
      for (const royal of me.court) {
        candidates.push({ type: "attach_spade", spadeCardId: cardId, targetRoyalId: royal.cardId });
      }
      // Recover the most valuable Royal/Joker retrievable from the Abyss.
      // Filter to Royals/Jokers FIRST — Royals have pip 1-3, so sorting the
      // whole Abyss by value and then checking the top card lets any high-pip
      // junk shadow them and the reclaim is never even considered.
      const retrievable = state.abyss
        .filter((abyssId) => {
          const t = getCard(abyssId);
          const value = t.isJoker ? 10 : t.pipValue;
          return (t.isRoyal || t.isJoker) && value <= card.pipValue;
        })
        .sort((a, b) => {
          const va = getCard(a).isJoker ? 10 : getCard(a).pipValue;
          const vb = getCard(b).isJoker ? 10 : getCard(b).pipValue;
          return vb - va;
        })[0];
      if (retrievable) {
        candidates.push({ type: "discard_spade_to_return", spadeCardId: cardId, targetCardId: retrievable });
      }
    }

    if (card.suit === "C" && !card.isRoyal && card.vaultCost <= vault) {
      for (const opp of opponents) {
        for (const royal of opp.court) {
          candidates.push({
            type: "apply_club",
            clubCardId: cardId,
            targetPlayerId: opp.id,
            targetRoyalId: royal.cardId,
          });
        }
        candidates.push({ type: "apply_club", clubCardId: cardId, targetPlayerId: opp.id });
      }
    }

    if (card.isJoker && card.vaultCost <= vault) {
      for (const opp of opponents) {
        for (const royal of opp.court) {
          candidates.push({
            type: "play_joker",
            cardId,
            mode: "destroy_royal",
            targetPlayerId: opp.id,
            targetRoyalId: royal.cardId,
          });
        }
        candidates.push({ type: "play_joker", cardId, mode: "damage_player", targetPlayerId: opp.id });
      }
    }
  }

  if (state.phase === "main" && !state.hasAttackedThisTurn) {
    const eligible = me.court.filter((r) => !r.hasteLocked && !r.hasAttackedThisTurn);
    if (eligible.length > 0 && opponents.length > 0) {
      const lowestLife = [...opponents].sort((a, b) => a.life - b.life)[0]!;
      // All-in.
      candidates.push({
        type: "declare_attack",
        targets: [{ targetPlayerId: lowestLife.id, royalCardIds: eligible.map((r) => r.cardId) }],
      });
      // Partial attacks: each single Royal (or just the strongest when the
      // court is large) — settle-scoring weighs the trade of each option.
      if (eligible.length > 1) {
        const singles =
          eligible.length <= 4
            ? eligible
            : [[...eligible].sort((a, b) => effectiveAttack(b) - effectiveAttack(a))[0]!];
        for (const royal of singles) {
          candidates.push({
            type: "declare_attack",
            targets: [{ targetPlayerId: lowestLife.id, royalCardIds: [royal.cardId] }],
          });
        }
      }
    }
  }

  candidates.push({ type: "end_turn" });
  return candidates;
}

function discardPhaseCandidates(state: GameState, botId: string): GameAction[] {
  const hand = state.players[botId]?.hand ?? [];
  return hand.map((cardId) => ({ type: "discard_to_end_turn", cardId }));
}

function declareBlocksCandidates(state: GameState, botId: string): GameAction[] {
  const me = state.players[botId];
  if (!me) return [];
  const incoming = botIncomingAttacks(state, botId);
  if (incoming.length === 0) return [];

  const allPass: Record<string, CardId[] | "pass"> = {};
  for (const attack of incoming) allPass[attack.attackerCardId] = "pass";

  const candidates: GameAction[] = [{ type: "confirm_declare_blocks", blocks: allPass }];

  // Blockers only need to not have attacked this turn (haste-locked Royals may block).
  const availableBlockers = me.court.filter((r) => !r.hasAttackedThisTurn);
  if (availableBlockers.length === 0) return candidates;

  const attackerRoyal = (attackerPlayerId: string, cardId: CardId) =>
    state.players[attackerPlayerId]?.court.find((r) => r.cardId === cardId);

  // Greedy "block the biggest threats" assignment: strongest incoming attacks
  // first, each assigned the best single blocker (prefer one that kills the
  // attacker, then one that survives the hit).
  const sortedIncoming = [...incoming].sort((a, b) => {
    const ra = attackerRoyal(a.attackerPlayerId, a.attackerCardId);
    const rb = attackerRoyal(b.attackerPlayerId, b.attackerCardId);
    return (rb ? effectiveAttack(rb) : 0) - (ra ? effectiveAttack(ra) : 0);
  });

  const greedy: Record<string, CardId[] | "pass"> = {};
  const used = new Set<CardId>();
  for (const attack of sortedIncoming) {
    const royal = attackerRoyal(attack.attackerPlayerId, attack.attackerCardId);
    if (!royal) {
      greedy[attack.attackerCardId] = "pass";
      continue;
    }
    const atkHealth = effectiveHealth(royal);
    const free = availableBlockers.filter((b) => !used.has(b.cardId));
    const killer = free
      .filter((b) => effectiveAttack(b) >= atkHealth)
      .sort((a, b) => effectiveAttack(a) - effectiveAttack(b))[0];
    const pick = killer ?? free.sort((a, b) => effectiveHealth(b) - effectiveHealth(a))[0];
    if (pick) {
      greedy[attack.attackerCardId] = [pick.cardId];
      used.add(pick.cardId);
    } else {
      greedy[attack.attackerCardId] = "pass";
    }
  }
  candidates.push({ type: "confirm_declare_blocks", blocks: greedy });

  // Selective: only block when the trade is favorable (blocker kills attacker),
  // pass everything else.
  const selective: Record<string, CardId[] | "pass"> = {};
  const usedSel = new Set<CardId>();
  for (const attack of sortedIncoming) {
    const royal = attackerRoyal(attack.attackerPlayerId, attack.attackerCardId);
    const atkHealth = royal ? effectiveHealth(royal) : 0;
    const killer = availableBlockers
      .filter((b) => !usedSel.has(b.cardId) && effectiveAttack(b) >= atkHealth)
      .sort((a, b) => effectiveAttack(a) - effectiveAttack(b))[0];
    if (royal && killer) {
      selective[attack.attackerCardId] = [killer.cardId];
      usedSel.add(killer.cardId);
    } else {
      selective[attack.attackerCardId] = "pass";
    }
  }
  candidates.push({ type: "confirm_declare_blocks", blocks: selective });

  // Gang block: when no single blocker can kill the biggest attacker but the
  // team can, pile every free blocker onto it and pass the rest.
  const biggest = sortedIncoming[0];
  const biggestRoyal = biggest
    ? attackerRoyal(biggest.attackerPlayerId, biggest.attackerCardId)
    : undefined;
  if (biggest && biggestRoyal && availableBlockers.length >= 2) {
    const atkHealth = effectiveHealth(biggestRoyal);
    const noSingleKiller = !availableBlockers.some((b) => effectiveAttack(b) >= atkHealth);
    const teamDamage = availableBlockers.reduce((s, b) => s + effectiveAttack(b), 0);
    if (noSingleKiller && teamDamage >= atkHealth) {
      const gang: Record<CardId, CardId[] | "pass"> = {};
      for (const attack of incoming) gang[attack.attackerCardId] = "pass";
      gang[biggest.attackerCardId] = availableBlockers.map((b) => b.cardId);
      candidates.push({ type: "confirm_declare_blocks", blocks: gang });
    }
  }

  return candidates;
}

function damageOrderCandidates(state: GameState, botId: string): GameAction[] {
  const defenderId = state.duelContext?.defenderPlayerId;
  const defender = defenderId ? state.players[defenderId] : undefined;
  const multi = state.attacks.filter(
    (a) => a.targetPlayerId === defenderId && a.blockerCardIds && a.blockerCardIds.length > 1,
  );

  const byHealthAsc: Record<string, string[]> = {};
  const byHealthDesc: Record<string, string[]> = {};
  for (const attack of multi) {
    const orderAsc = [...attack.blockerCardIds!].sort((a, b) => {
      const ra = defender?.court.find((r) => r.cardId === a);
      const rb = defender?.court.find((r) => r.cardId === b);
      return (ra ? effectiveHealth(ra) : 0) - (rb ? effectiveHealth(rb) : 0);
    });
    byHealthAsc[attack.attackerCardId] = orderAsc;
    byHealthDesc[attack.attackerCardId] = [...orderAsc].reverse();
  }

  return [
    { type: "set_damage_order", assignments: byHealthAsc },
    { type: "set_damage_order", assignments: byHealthDesc },
  ];
}

function duelCandidates(state: GameState, botId: string): GameAction[] {
  const me = state.players[botId];
  const ctx = state.duelContext;
  const candidates: GameAction[] = [{ type: "duel_pass" }];
  if (!me || !ctx) return candidates;

  const isAttacker = botId === ctx.attackerPlayerId;
  const diamondUsed = isAttacker ? ctx.attackerDiamondUsed : ctx.defenderDiamondUsed;
  const vault = availableVault(state.mine, me);

  for (const cardId of me.hand) {
    const card = getCard(cardId);
    if (card.isRoyal) continue;
    if (card.vaultCost > vault) continue;

    if (card.suit === "D" && !diamondUsed) {
      candidates.push({ type: "discard_diamond_to_draw", cardId });
    }
    if (card.suit === "H" && me.life < 20) {
      candidates.push({ type: "discard_heart_to_heal", heartCardId: cardId });
    }
    if (card.suit === "H" || card.suit === "S") {
      // Buff own Royals that are fighting in the current duel.
      const pairRoyalIds = new Set<CardId>();
      for (const attack of state.attacks) {
        if (attack.targetPlayerId !== ctx.defenderPlayerId) continue;
        if (!attack.blockerCardIds?.length) continue;
        if (isAttacker) pairRoyalIds.add(attack.attackerCardId);
        else for (const b of attack.blockerCardIds) pairRoyalIds.add(b);
      }
      for (const royal of me.court) {
        if (!pairRoyalIds.has(royal.cardId)) continue;
        if (card.suit === "H") {
          candidates.push({ type: "attach_heart", heartCardId: cardId, targetRoyalId: royal.cardId });
        } else {
          candidates.push({ type: "attach_spade", spadeCardId: cardId, targetRoyalId: royal.cardId });
        }
      }
    }
  }

  return candidates;
}

function respondToClubCandidates(state: GameState, botId: string): GameAction[] {
  const me = state.players[botId];
  const pending = state.pendingClubDebuff;
  const candidates: GameAction[] = [{ type: "confirm_club_response" }];
  if (!me || !pending) return candidates;

  const vault = availableVault(state.mine, me);

  // The response window grants one free Diamond action — card advantage the
  // bot should rarely pass up. Scoring decides.
  if (!pending.defenderDiamondUsed) {
    for (const cardId of me.hand) {
      const card = getCard(cardId);
      if (card.suit === "D" && !card.isRoyal) {
        candidates.push({ type: "discard_diamond_to_draw", cardId });
        break;
      }
    }
  }

  const targetRoyal = me.court.find((r) => r.cardId === pending.targetRoyalId);
  if (!targetRoyal) return candidates;

  // Attach options are always enumerated: settleForScoring auto-confirms the
  // pending debuff during scoring, so "attach then eat the Club" is compared
  // fairly against "just confirm" and the scorer decides when a save is worth
  // the card.
  for (const cardId of me.hand) {
    const card = getCard(cardId);
    if (card.isRoyal || card.vaultCost > vault) continue;
    if (card.suit === "H" || card.suit === "S") {
      const action: GameAction =
        card.suit === "H"
          ? { type: "attach_heart", heartCardId: cardId, targetRoyalId: pending.targetRoyalId }
          : { type: "attach_spade", spadeCardId: cardId, targetRoyalId: pending.targetRoyalId };
      candidates.push(action);
    }
  }

  return candidates;
}

/**
 * Enumerates candidate actions for the phase in which the bot currently holds
 * priority. Candidates are a curated set, not the full action space; each is
 * validated by the engine during scoring, so an over-generated candidate is
 * harmless (it just gets filtered).
 */
export function enumerateCandidateActions(state: GameState, botId: string): GameAction[] {
  switch (state.phase) {
    case "main":
    case "declare_attacks":
      return mainPhaseCandidates(state, botId);
    case "discard":
      return discardPhaseCandidates(state, botId);
    case "declare_blocks":
      return declareBlocksCandidates(state, botId);
    case "assign_damage_order":
      return damageOrderCandidates(state, botId);
    case "duel_attacker_turn":
    case "duel_blocker_turn":
      return duelCandidates(state, botId);
    case "respond_to_club":
      return respondToClubCandidates(state, botId);
    default:
      return [];
  }
}

/** Cap softmax sampling to the strongest few options so the tail of weak-but-legal moves stays rare. */
const TOP_K = 6;

/**
 * Softmax-samples one of the scored candidates. A winning move is never left
 * to chance. Assumes `scored` is non-empty.
 */
function sampleByScore(
  scored: Array<{ action: GameAction; score: number }>,
  temperature: number,
  rng: () => number,
): GameAction {
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  const top = sorted.slice(0, TOP_K);

  if (top[0]!.score >= WIN_SCORE) return top[0]!.action;

  const t = Math.max(temperature, 0.01);
  const maxScore = top[0]!.score;
  const weights = top.map((c) => Math.exp((c.score - maxScore) / t));
  const total = weights.reduce((s, w) => s + w, 0);

  let roll = rng() * total;
  for (let i = 0; i < top.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return top[i]!.action;
  }
  return top[top.length - 1]!.action;
}

/**
 * Settles transient windows before evaluating, so a play's score reflects its
 * actual outcome rather than a half-resolved intermediate state:
 *
 * - A Club aimed at a Royal parks the game in respond_to_club with the debuff
 *   pending — scored as-is it looks like pure cost and the bot would never
 *   club a Royal. Let the target confirm.
 * - declare_attack lands in declare_blocks with NO damage applied — scored
 *   as-is attacking has zero visible upside (and with the defensive-readiness
 *   term it would look strictly bad). Play combat forward with a simple
 *   deterministic model: the defender answers with the greedy-block line,
 *   damage order ascending, duel participants pass. The same settling makes
 *   the bot's own block choices see their resolved trades.
 *
 * The model is only a prediction of the opponent (a real player may respond
 * differently), but a plausible resolved outcome beats a blind intermediate
 * one. Bounded steps; every dispatch is engine-validated.
 */
function settleForScoring(state: GameState): GameState {
  let current = state;
  for (let step = 0; step < 14; step++) {
    if (isGameOver(current)) break;

    if (current.phase === "respond_to_club" && current.pendingClubDebuff) {
      const targetId = current.pendingClubDebuff.targetPlayerId;
      const res = dispatchAction(current, targetId, { type: "confirm_club_response" });
      if (!res.ok) break;
      current = res.value;
      continue;
    }

    if (current.phase === "declare_blocks") {
      const holderId = getTurnHolderId(current);
      if (!holderId) break;
      const options = declareBlocksCandidates(current, holderId);
      // options[1] is the greedy-block line when the defender has blockers;
      // options[0] is all-pass.
      const blocks = options[1] ?? options[0];
      if (!blocks) break;
      const res = dispatchAction(current, holderId, blocks);
      if (!res.ok) break;
      current = res.value;
      continue;
    }

    if (current.phase === "assign_damage_order") {
      const holderId = getTurnHolderId(current);
      if (!holderId) break;
      const res = dispatchAction(current, holderId, damageOrderCandidates(current, holderId)[0]!);
      if (!res.ok) break;
      current = res.value;
      continue;
    }

    if (current.phase === "duel_attacker_turn" || current.phase === "duel_blocker_turn") {
      const holderId = getTurnHolderId(current);
      if (!holderId) break;
      const res = dispatchAction(current, holderId, { type: "duel_pass" });
      if (!res.ok) break;
      current = res.value;
      continue;
    }

    break;
  }
  return current;
}

export function chooseBotAction(
  state: GameState,
  botId: string,
  options: { persona?: BotPersona; rng?: () => number } = {},
): GameAction {
  const persona = options.persona ?? personaForMatch(state.matchId);
  const rng = options.rng ?? Math.random;
  const fallback = fallbackAction(state, botId);

  const candidates = enumerateCandidateActions(state, botId);
  const scored: Array<{ action: GameAction; score: number }> = [];

  for (const action of candidates) {
    const result = dispatchAction(state, botId, action);
    if (!result.ok) continue;
    scored.push({ action, score: evaluateState(settleForScoring(result.value), botId, persona) });
  }

  if (scored.length === 0) return fallback;

  return sampleByScore(scored, persona.temperature, rng);
}

// ---------------------------------------------------------------------------
// Interrupts — playing cards while someone ELSE holds priority.
//
// The engine allows any non-turn-holder to play an eligible card at any time
// (dispatchAction routes it through the immediate-interrupt path), and a
// non-active player's Vault resets at their own turn start, so Vault left
// unspent during an opponent's turn is simply wasted — good players react.
// The bot mirrors that: after each human action the runner asks whether an
// interrupt is clearly worth it (score gain over doing nothing must beat a
// threshold, so the bot doesn't machine-gun its whole hand).
// ---------------------------------------------------------------------------

/** Phases in which the bot considers interrupting when it lacks priority. */
const INTERRUPT_PHASES: TurnPhase[] = [
  "main",
  "declare_blocks",
  "duel_attacker_turn",
  "duel_blocker_turn",
];

/** Minimum evaluation gain over "do nothing" before an interrupt is played. */
const INTERRUPT_MIN_GAIN = 1;

/**
 * Interrupt-eligible candidate plays (no Royals-to-court, no attacks, no
 * Diamond-to-Mine — the engine forbids those outside the bot's own turn).
 */
export function enumerateInterruptCandidates(state: GameState, botId: string): GameAction[] {
  const me = state.players[botId];
  if (!me || me.isEliminated) return [];
  const vault = availableVault(state.mine, me);
  const opponents = nonEliminatedOpponents(state, botId);
  const candidates: GameAction[] = [];

  for (const cardId of me.hand) {
    const card = getCard(cardId);
    if (card.isRoyal) continue;
    if (card.vaultCost > vault) continue;

    if (card.suit === "H") {
      for (const royal of me.court) {
        candidates.push({ type: "attach_heart", heartCardId: cardId, targetRoyalId: royal.cardId });
      }
      if (me.life < 20) {
        candidates.push({ type: "discard_heart_to_heal", heartCardId: cardId });
      }
    }

    if (card.suit === "S") {
      for (const royal of me.court) {
        candidates.push({ type: "attach_spade", spadeCardId: cardId, targetRoyalId: royal.cardId });
      }
      const reclaim = state.abyss
        .filter((abyssId) => {
          const t = getCard(abyssId);
          const value = t.isJoker ? 10 : t.pipValue;
          return (t.isRoyal || t.isJoker) && value <= card.pipValue;
        })
        .sort((a, b) => {
          const va = getCard(a).isJoker ? 10 : getCard(a).pipValue;
          const vb = getCard(b).isJoker ? 10 : getCard(b).pipValue;
          return vb - va;
        })[0];
      if (reclaim) {
        candidates.push({ type: "discard_spade_to_return", spadeCardId: cardId, targetCardId: reclaim });
      }
    }

    if (card.suit === "C") {
      for (const opp of opponents) {
        for (const royal of opp.court) {
          candidates.push({
            type: "apply_club",
            clubCardId: cardId,
            targetPlayerId: opp.id,
            targetRoyalId: royal.cardId,
          });
        }
        candidates.push({ type: "apply_club", clubCardId: cardId, targetPlayerId: opp.id });
      }
    }

    if (card.isJoker) {
      for (const opp of opponents) {
        for (const royal of opp.court) {
          candidates.push({
            type: "play_joker",
            cardId,
            mode: "destroy_royal",
            targetPlayerId: opp.id,
            targetRoyalId: royal.cardId,
          });
        }
        candidates.push({ type: "play_joker", cardId, mode: "damage_player", targetPlayerId: opp.id });
      }
    }

    // The engine allows one Diamond action per round; if the bot already used
    // it on its own turn the draw would just be rejected — skip the noise.
    if (card.suit === "D" && !me.hasPlayedDiamondThisTurn) {
      candidates.push({ type: "discard_diamond_to_draw", cardId });
    }
  }

  return candidates;
}

/** Introspection payload for the runner's decision logs. */
export interface InterruptDecisionDebug {
  phase: TurnPhase;
  vaultAvailable: number;
  candidateCount: number;
  legalCount: number;
  baseline: number;
  bestScore: number | null;
  threshold: number;
}

/**
 * Decides whether the bot should interrupt right now. Returns the chosen
 * action, or null when nothing beats staying quiet by at least
 * INTERRUPT_MIN_GAIN. Unlike chooseBotAction there is no fallback — doing
 * nothing is always a legal "move" here.
 */
export function chooseBotInterrupt(
  state: GameState,
  botId: string,
  options: {
    persona?: BotPersona;
    rng?: () => number;
    debug?: (info: InterruptDecisionDebug) => void;
  } = {},
): GameAction | null {
  if (!INTERRUPT_PHASES.includes(state.phase)) return null;
  if (isGameOver(state)) return null;

  const persona = options.persona ?? personaForMatch(state.matchId);
  const rng = options.rng ?? Math.random;
  // Settle the baseline with the same model as the candidates, so mid-combat
  // comparisons are apples-to-apples.
  const baseline = evaluateState(settleForScoring(state), botId, persona);

  const candidates = enumerateInterruptCandidates(state, botId);
  const scored: Array<{ action: GameAction; score: number }> = [];
  let legalCount = 0;
  let bestScore: number | null = null;
  for (const action of candidates) {
    const result = dispatchAction(state, botId, action);
    if (!result.ok) continue;
    legalCount++;
    const score = evaluateState(settleForScoring(result.value), botId, persona);
    if (bestScore === null || score > bestScore) bestScore = score;
    if (score >= baseline + INTERRUPT_MIN_GAIN) scored.push({ action, score });
  }

  options.debug?.({
    phase: state.phase,
    vaultAvailable: state.players[botId] ? availableVault(state.mine, state.players[botId]!) : 0,
    candidateCount: candidates.length,
    legalCount,
    baseline,
    bestScore,
    threshold: INTERRUPT_MIN_GAIN,
  });

  if (scored.length === 0) return null;
  return sampleByScore(scored, persona.temperature, rng);
}
