import { describe, it, expect, vi } from "vitest";
import { chooseBotAction, createRng, personaForMatch } from "../bot";
import { dispatchAction, getTurnHolderId } from "../dispatcher";
import { createInitialGameState, dealInitialHands, determineFirstPlayer } from "../setup";
import { isGameOver, getWinner } from "../turn";
import { getCard } from "../cards";
import { availableVault } from "../vault";
import type { GameState, PlayerState } from "../types";
import { P1, P2 } from "./helpers";

/**
 * Bot-vs-bot simulation harness.
 *
 * The existing "deadlock canary" playout only proves games terminate. This one
 * measures how the bot actually PLAYS, so behavioural regressions (the kind we
 * previously only caught by hand-playing 17 games and reading the DB) show up
 * in CI instead.
 *
 * The headline metric is `deathsHoldingAffordableHeart`: how often a player is
 * eliminated while still holding a non-Royal Heart it had the Vault to play.
 * That is exactly the bug the survival-urgency term was added to fix.
 *
 * Determinism: the bot takes a seeded `rng`, but deck setup goes through
 * `shuffle()` in cards.ts which calls Math.random — so Math.random is stubbed
 * with a seeded PRNG too, making the whole run reproducible.
 */

/**
 * 40 games was too noisy to gate on: it read 17.5% for the headline metric
 * while a 180-game diagnostics run over the same code put the true rate at
 * 9.4% — close enough to the threshold that an unrelated change could flip the
 * suite red for no reason. The run costs ~180ms, so more games is cheap.
 */
const GAMES = 150;
const MAX_ACTIONS = 3000;

/** Non-Royal Hearts this player could actually afford to play right now. */
function affordableHearts(state: GameState, player: PlayerState): string[] {
  const vault = availableVault(state.mine, player);
  return player.hand.filter((cardId) => {
    const card = getCard(cardId);
    return card.suit === "H" && !card.isRoyal && card.vaultCost <= vault;
  });
}

interface Stats {
  finished: number;
  stalemates: number;
  totalActions: number;
  actionCounts: Record<string, number>;
  deaths: number;
  deathsHoldingAffordableHeart: number;
  heartsHeldAtDeath: string[][];
  perPersona: Record<string, { games: number; deaths: number; deathsWithHeart: number }>;
}

describe("bot-vs-bot simulation (behavioural metrics)", () => {
  it(
    `plays ${GAMES} full games and reports how the bot behaves`,
    () => {
      // Seed Math.random so deck shuffling is reproducible run-to-run.
      const seededGlobal = createRng(987654321);
      const randomSpy = vi.spyOn(Math, "random").mockImplementation(seededGlobal);

      const stats: Stats = {
        finished: 0,
        stalemates: 0,
        totalActions: 0,
        actionCounts: {},
        deaths: 0,
        deathsHoldingAffordableHeart: 0,
        heartsHeldAtDeath: [],
        perPersona: {},
      };

      try {
        for (let game = 0; game < GAMES; game++) {
          const matchId = `sim-${game}`;
          const persona = personaForMatch(matchId).name;
          if (!stats.perPersona[persona]) {
            stats.perPersona[persona] = { games: 0, deaths: 0, deathsWithHeart: 0 };
          }
          stats.perPersona[persona]!.games++;

          const rng = createRng(game + 1);
          const init = createInitialGameState(matchId, [P1, P2]);
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
            if (!holderId) break;

            const prev = state;
            const action = chooseBotAction(state, holderId, { rng });
            const result = dispatchAction(state, holderId, action);
            if (!result.ok) {
              // Total card exhaustion is a stalemate, not a bot bug (same
              // tolerance as the deadlock canary).
              expect(
                result.error,
                `game ${game}: ${JSON.stringify(action)} rejected in ${state.phase}: ${result.error}`,
              ).toMatch(/no cards to draw/i);
              stalemate = true;
              break;
            }

            stats.actionCounts[action.type] = (stats.actionCounts[action.type] ?? 0) + 1;
            state = result.value;
            actions++;

            // Detect anyone who died as a result of this action, and inspect
            // what they were holding while still alive (prev state).
            for (const id of state.turnOrder) {
              const before = prev.players[id];
              const after = state.players[id];
              if (!before || !after) continue;
              if (before.isEliminated || !after.isEliminated) continue;

              stats.deaths++;
              stats.perPersona[persona]!.deaths++;
              const hearts = affordableHearts(prev, before);
              if (hearts.length > 0) {
                stats.deathsHoldingAffordableHeart++;
                stats.perPersona[persona]!.deathsWithHeart++;
                stats.heartsHeldAtDeath.push(hearts);
              }
            }
          }

          stats.totalActions += actions;
          if (stalemate) stats.stalemates++;
          else if (isGameOver(state)) {
            stats.finished++;
            expect(getWinner(state)).toBeTruthy();
          }
        }
      } finally {
        randomSpy.mockRestore();
      }

      const heals = stats.actionCounts["discard_heart_to_heal"] ?? 0;
      const deathRate =
        stats.deaths > 0 ? stats.deathsHoldingAffordableHeart / stats.deaths : 0;

      // eslint-disable-next-line no-console
      console.log(
        [
          "",
          `=== bot-vs-bot simulation: ${GAMES} games ===`,
          `finished: ${stats.finished}  stalemates: ${stats.stalemates}  avg actions/game: ${(
            stats.totalActions / GAMES
          ).toFixed(1)}`,
          `deaths: ${stats.deaths}`,
          `deaths holding an AFFORDABLE Heart: ${stats.deathsHoldingAffordableHeart} (${(
            deathRate * 100
          ).toFixed(1)}%)`,
          stats.heartsHeldAtDeath.length > 0
            ? `  unplayed Hearts at death: ${stats.heartsHeldAtDeath
                .slice(0, 10)
                .map((h) => h.join("/"))
                .join(", ")}`
            : "  (none)",
          `heals played: ${heals}`,
          "per persona: " +
            Object.entries(stats.perPersona)
              .map(
                ([name, s]) =>
                  `${name} games=${s.games} deaths=${s.deaths} withHeart=${s.deathsWithHeart}`,
              )
              .join(" | "),
          "action mix: " +
            Object.entries(stats.actionCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([t, n]) => `${t}=${n}`)
              .join(" "),
          "",
        ].join("\n"),
      );

      // Sanity: the simulation actually ran games to a conclusion.
      expect(stats.finished + stats.stalemates).toBe(GAMES);
      expect(stats.deaths).toBeGreaterThan(0);

      // The bot must actually use Hearts to stay alive.
      expect(heals, "bot never healed across the whole simulation").toBeGreaterThan(0);

      // The regression guard for this fix: dying with a playable Heart still in
      // hand should be rare. Pre-fix this was the norm (3 of 6 observed losses).
      //
      // TODO(threshold): re-derive from THIS run's printed rate at 150 games,
      // then set to roughly observed x 1.5 and record the observed value here.
      // 0.2 was calibrated against a 40-game sample under the old rules, before
      // immediate elimination removed the heal-back-from-0 escape hatch.
      expect(
        deathRate,
        `died holding an affordable Heart in ${(deathRate * 100).toFixed(1)}% of deaths`,
      ).toBeLessThan(0.2);
    },
    180_000,
  );
});
