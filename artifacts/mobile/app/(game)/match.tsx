import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ScrollView,
  ActivityIndicator,
  Alert,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import * as Haptics from "expo-haptics";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import {
  useGetMatchState,
  useGetMatch,
  useSubmitGameAction,
  useAbandonMatch,
  getGetMatchStateQueryKey,
  getGetMatchQueryKey,
} from "@workspace/api-client-react";
import type {
  PlayerGameView,
  PublicPlayerState,
  GameActionRequest,
} from "@workspace/api-client-react";
import { useAuth as useClerkAuth } from "@clerk/clerk-expo";
import { useAuth } from "@/lib/auth";
import Colors, { seatColorFor } from "@/constants/colors";
import { personaMageName } from "@/constants/botPersonas";
import { Gradients } from "@/constants/theme";
import HandTray from "@/components/game/HandTray";
import Seat from "@/components/game/Seat";
import SanctumBackground from "@/components/game/SanctumBackground";
import TableCenter from "@/components/game/TableCenter";
import EventTicker from "@/components/game/EventTicker";
import type { GameEvent } from "@/components/game/EventTicker";
import { RichLine } from "@/components/game/EventTicker";
import ActionDock from "@/components/game/ActionDock";
import AbyssPicker from "@/components/game/AbyssPicker";
import BlockPanel from "@/components/game/BlockPanel";
import DuelStage from "@/components/game/DuelStage";
import DamageOrderModal from "@/components/game/DamageOrderModal";
import ToastHost from "@/components/game/ToastHost";
import type { Toast } from "@/components/game/ToastHost";
import CardView from "@/components/game/CardView";
import {
  parseCardId,
  getValidActionsForCard,
  isDuelTurnPhase,
  isInterruptPhase,
  effectiveAttack,
  effectiveHealth,
  canPlayerInitiateInterrupt,
} from "@/lib/gameUtils";
import type { CardAction, ValidAction } from "@/lib/gameUtils";
import { markLocalCast, useHitEffects } from "@/lib/hitEffects";
import { getSfxMuted, playGameSfx, preloadSfx, setSfxMuted } from "@/lib/sfx";
import {
  CardFlightHost,
  CARD_FLIGHT_TTL_MS,
  type CardFlightEvent,
} from "@/components/game/effects/CardFlight";
import TurnFlare from "@/components/game/effects/TurnFlare";
import YourTurnBanner from "@/components/game/effects/YourTurnBanner";

export interface ActionParams {
  cardId: string;
  action: string;
  targetRoyalId?: string;
  targetPlayerId?: string;
  targetCardId?: string;
  mode?: string;
}

// Just the Royal fields the match log needs to name a card with its totals.
type RoyalStats = { cardId: string; buffAttack: number; buffHealth: number; damageTaken: number };


// e.g. "8♣" — rank + suit symbol only.
function cardLabel(id: string): string {
  const c = parseCardId(id);
  return `${c.displayRank}${c.suitSymbol}`;
}

// A Royal named with its effective totals, e.g. "K♥ (⚔10 ♥4)". Used everywhere
// the log mentions a Royal so a card is never shown without its value — for a
// destroyed Royal, pass its last-known stats from a snapshot.
// Buffed values are written as a visible sum so attachment effects are never
// hidden: "♥3+1" = base-minus-damage 3 plus +1 buff (effective 4). The two
// terms always add up to the effective total shown on the board badge.
function royalStatLabel(r: RoyalStats): string {
  const atk = effectiveAttack(r.cardId, r.buffAttack);
  const hp = effectiveHealth(r.cardId, r.buffHealth, r.damageTaken);
  const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
  const atkStr = r.buffAttack !== 0 ? `${atk - r.buffAttack}${sign(r.buffAttack)}` : `${atk}`;
  const hpStr = r.buffHealth !== 0 ? `${hp - r.buffHealth}${sign(r.buffHealth)}` : `${hp}`;
  return `${cardLabel(r.cardId)} (⚔${atkStr} ♥${hpStr})`;
}

// Plain-language names for engine phases — raw ids read as jargon.
const PHASE_LABELS: Record<string, string> = {
  draw: "Draw",
  main: "Main phase",
  declare_attacks: "Declaring attacks",
  declare_blocks: "Blocks being chosen",
  assign_damage_order: "Damage order",
  duel_attacker_turn: "Duel",
  duel_blocker_turn: "Duel",
  resolve_combat: "Combat",
  end_turn: "End of turn",
  discard: "Discarding",
  respond_to_club: "Club response",
  interrupt_window: "Interrupt",
};

// Light haptic feedback on the phone; no-op on web.
function buzzSelect() {
  if (Platform.OS !== "web") Haptics.selectionAsync();
}
function buzzAction() {
  if (Platform.OS !== "web") Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
}

// Short board-targeting hints shown in the ActionDock for each action.
function targetHintFor(a: ValidAction, pip: number): string | null {
  switch (a.action) {
    case "attach_heart":
      return `Tap a glowing Royal → +${pip} health`;
    case "attach_spade":
      return `Tap a glowing Royal → +${pip} attack & defense`;
    case "apply_club":
      return `Tap a glowing Royal → −${pip} to its stats`;
    case "discard_heart_to_heal":
      return `Tap a player's name → heal them +${pip}`;
    case "apply_club_damage":
      return `Tap a player's name → deal ${pip} damage`;
    case "discard_diamond_for_boost":
      return `Tap a player's name → +${pip} Vault boost`;
    case "play_joker":
      return a.targetType === "any_royal"
        ? "Tap a Royal → destroy it"
        : "Tap a player's name → 10 damage";
    default:
      return null;
  }
}

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const { getToken } = useClerkAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Web preview renders inside a simulated phone frame that doesn't expose
  // real safe-area insets — keep its tested constants.
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [gameState, setGameState] = useState<PlayerGameView | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  // Scroll the board to the opponents when picking attack targets.
  const boardScrollRef = useRef<ScrollView>(null);
  // Real-time state comes over the WebSocket; when it's up, HTTP polling drops
  // to a slow safety-net interval. When it's down we poll fast (as before).
  const wsRef = useRef<WebSocket | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  // Narrates each resolved action into the match log. Kept in a ref (assigned
  // every render, like playersParamRef) so the long-lived WebSocket onmessage
  // closure always calls the freshest version.
  const logActionRef = useRef<
    ((la: { actorUserId: string; action: GameActionRequest }, view: PlayerGameView) => void) | null
  >(null);

  const [attackSelectMode, setAttackSelectMode] = useState(false);
  const [selectedAttackRoyalIds, setSelectedAttackRoyalIds] = useState<Set<string>>(new Set());
  const [assigningTargets, setAssigningTargets] = useState(false);
  const [targetAssignments, setTargetAssignments] = useState<Record<string, string>>({});
  const [activeAssignRoyalId, setActiveAssignRoyalId] = useState<string | null>(null);

  // 4-player board: which opponent seat is expanded ("in focus").
  const [focusedOpponentId, setFocusedOpponentId] = useState<string | null>(null);
  const [abyssPickerAction, setAbyssPickerAction] = useState<ValidAction | null>(null);
  // Debug/testing: which opponent's revealed hand (AI seats only) is open.
  const [revealedHandPlayerId, setRevealedHandPlayerId] = useState<string | null>(null);
  // A dock chip that needs a board target (e.g. Diamond boost) the player has
  // tapped — the board then highlights legal targets to finish the play.
  const [armedAction, setArmedAction] = useState<ValidAction | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  // Non-blocking feedback + rolling match log.
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [events, setEvents] = useState<GameEvent[]>([]);
  const idCounterRef = useRef(1);

  const showToast = useCallback((text: string, tone: Toast["tone"] = "info") => {
    const id = idCounterRef.current++;
    setToasts((prev) => [...prev.slice(-2), { id, text, tone }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3200);
  }, []);

  const pushEvent = useCallback(
    (
      color: string,
      text: string,
      extra?: { actor?: string; sublines?: string[]; tag?: string },
    ) => {
      const id = idCounterRef.current++;
      setEvents((prev) => [...prev.slice(-60), { id, color, text, at: Date.now(), ...extra }]);
    },
    [],
  );

  const prevPhaseRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<Record<string, { life: number; court: RoyalStats[]; eliminated: boolean }>>({});
  const prevActivePlayerRef = useRef<string | null>(null);
  const prevPendingClubRef = useRef<string | null>(null);
  const hasNavigatedRef = useRef(false);
  // Game-over reveal: stay on the final board with a compact winner banner so
  // the player can review what happened (expand the ticker, inspect courts).
  // Navigation to the results screen only happens via the banner's button —
  // no auto-advance.
  const revealShownRef = useRef(false);
  // Winner mirrored in a ref so long-lived closures (the WS handler) can read
  // it without going stale.
  const revealWinnerRef = useRef<string | null>(null);
  const [gameOverReveal, setGameOverReveal] = useState<{ winnerUserId: string | null } | null>(null);

  // Duel tracking: snapshot each duel when it starts so we can diff courts +
  // life when it ends and explain the outcome. completedDuels feeds the ✓
  // rows in the duel stage; duelNotice is the after-combat result panel.
  const duelSnapshotRef = useRef<{
    attackerId: string;
    defenderId: string;
    pairs: { attackerCardId: string; blockerIds: string[] }[];
    lives: Record<string, number>;
    // Last-known stats of every Royal in the duel, so a destroyed Royal can
    // still be named with its totals in the outcome.
    stats: Record<string, RoyalStats>;
  } | null>(null);
  const [completedDuels, setCompletedDuels] = useState<{ id: number; text: string }[]>([]);
  const [duelNotice, setDuelNotice] = useState<{ id: number; header?: string; title: string; lines: string[] } | null>(null);

  // The result panel informs without blocking: it auto-clears after ~9s.
  useEffect(() => {
    if (!duelNotice) return;
    const t = setTimeout(() => setDuelNotice(null), 9000);
    return () => clearTimeout(t);
  }, [duelNotice?.id]);

  // Elimination announcement: a prominent overlay explaining WHY a court
  // suddenly vanished (life hit 0 → every court card swept to the Abyss).
  // Dismissible, and auto-clears after ~10s so it can't block forever.
  const [elimNotice, setElimNotice] = useState<{
    id: number;
    playerId: string;
    sweptCount: number;
  } | null>(null);
  useEffect(() => {
    if (!elimNotice) return;
    const t = setTimeout(() => setElimNotice(null), 10000);
    return () => clearTimeout(t);
  }, [elimNotice?.id]);

  // Direct-hit dedup: lastDirectHit.seq is monotonic per match; remember the
  // last seq we toasted so rejoining mid-match doesn't replay an old hit.
  const seenDirectHitSeqRef = useRef<number | null>(null);
  const seenLifeEventSeqRef = useRef<number | null>(null);

  const { data: stateData, isLoading } = useGetMatchState(matchId ?? "", {
    query: {
      queryKey: getGetMatchStateQueryKey(matchId ?? ""),
      enabled: !!matchId,
      refetchInterval: wsConnected ? 15000 : 2000,
    },
  });

  const { data: matchData } = useGetMatch(matchId ?? "", {
    query: {
      queryKey: getGetMatchQueryKey(matchId ?? ""),
      enabled: !!matchId,
      refetchInterval: wsConnected ? 15000 : 2000,
    },
  });

  useEffect(() => {
    // When the socket is live it's the source of truth; ignore the slow-poll
    // snapshots so an in-flight poll can't clobber newer realtime state.
    if (wsConnected) return;
    if (stateData?.state) {
      setGameState(stateData.state);
    }
  }, [stateData, wsConnected]);

  useEffect(() => {
    if (matchData?.players) {
      // Prefer the resolved persona so "random" shows the mage actually playing.
      const mageName = personaMageName(
        matchData.match?.botPersonaResolved ?? matchData.match?.botPersona ?? null,
      );
      const names: Record<string, string> = {};
      for (const p of matchData.players) {
        // Show the chosen bot style alongside the AI Mage's name so the
        // player always knows which persona they're facing.
        names[p.userId] =
          p.isBot && mageName ? `${p.displayName} · ${mageName}` : p.displayName;
      }
      setDisplayNames(names);
    }
  }, [matchData]);

  // The AI opponent's seat (vs-AI matches only) — used to phrase waiting
  // states as "thinking" rather than "waiting", since the bot never idles.
  const botPlayerId = useMemo(
    () => matchData?.players?.find((p) => p.isBot)?.userId ?? null,
    [matchData?.players],
  );

  // Always-current players snapshot stored in a ref so that closures with stale
  // deps (e.g. the WebSocket onmessage handler) can still read the latest value.
  // Using useMemo with explicit deps so React Compiler cannot silently cache this.
  const playersParamRef = useRef("");
  const _playersParam = React.useMemo(() => {
    if (matchData?.players?.length) {
      return JSON.stringify(
        matchData.players.map((p, i) => ({ userId: p.userId, displayName: p.displayName, seatIndex: i })),
      );
    }
    const order = gameState?.turnOrder ?? [];
    if (order.length) {
      return JSON.stringify(
        order.map((uid, i) => ({ userId: uid, displayName: displayNames[uid] ?? uid.slice(0, 8), seatIndex: i })),
      );
    }
    return "";
  }, [matchData?.players, gameState?.turnOrder, displayNames]);
  playersParamRef.current = _playersParam;

  const navigateToGameOver = useCallback(
    (winnerUserId: string | null) => {
      if (hasNavigatedRef.current) return;
      hasNavigatedRef.current = true;
      router.replace({
        pathname: "/(game)/game-over",
        params: {
          matchId: matchId ?? "",
          winnerUserId: winnerUserId ?? "",
          players: playersParamRef.current,
        },
      });
    },
    [matchId, router],
  );

  // Single entry point for every "match ended" signal (WS game_over, the
  // status poll, the winning-action response, abandon). A real winner shows
  // the review banner and waits for the player; an abandon (no winner) exits
  // immediately — there's nothing to review.
  const beginGameOver = useCallback(
    (winnerUserId: string | null) => {
      if (revealShownRef.current) return;
      revealShownRef.current = true;
      if (!winnerUserId) {
        navigateToGameOver(null);
        return;
      }
      revealWinnerRef.current = winnerUserId;
      setGameOverReveal({ winnerUserId });
    },
    [navigateToGameOver],
  );

  useEffect(() => {
    if (matchData?.match?.status === "finished") {
      beginGameOver(matchData.match.winnerUserId ?? null);
    }
  }, [matchData?.match?.status, matchData?.match?.winnerUserId, beginGameOver]);

  // Real-time state over WebSocket. The server already pushes a per-player
  // view on every action (state_update / game_started / game_over) plus a
  // reconnect snapshot; we apply those directly instead of waiting on the
  // 2s poll. Polling stays on as a slow fallback (see refetchInterval above)
  // and takes over immediately if the socket drops.
  useEffect(() => {
    if (!matchId) return;
    let mounted = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    async function connect() {
      const domain = process.env.EXPO_PUBLIC_DOMAIN ?? "";
      if (!domain) return; // no realtime endpoint configured — polling covers it
      let token: string | null = null;
      try {
        token = await getToken();
      } catch {
        // fall through; server will reject an unauthenticated socket and we
        // keep polling
      }
      if (!mounted) return;

      const wsUrl = `wss://${domain}/ws?matchId=${matchId}`;
      const protocols = token ? [`bearer-${token}`] : undefined;
      const ws = new WebSocket(wsUrl, protocols);
      wsRef.current = ws;

      ws.onopen = () => {
        if (!mounted) return;
        setWsConnected(true);
        ws.send(JSON.stringify({ type: "join_match", matchId }));
      };

      ws.onmessage = (event) => {
        if (!mounted) return;
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            state?: PlayerGameView;
            winnerUserId?: string | null;
            lastAction?: { actorUserId: string; action: GameActionRequest };
          };
          if (
            (msg.type === "state_update" || msg.type === "game_over") &&
            msg.lastAction &&
            msg.state
          ) {
            logActionRef.current?.(msg.lastAction, msg.state);
          }
          if (
            (msg.type === "state_update" ||
              msg.type === "game_started" ||
              msg.type === "reconnect_state" ||
              msg.type === "game_over") &&
            msg.state
          ) {
            setGameState(msg.state);
          }
          if (msg.type === "game_over") {
            beginGameOver(msg.winnerUserId ?? null);
          }
          // If the other player starts a rematch while we're lingering on the
          // final board, move along to the results screen — its existing
          // rematch-room discovery takes over from there.
          if (msg.type === "rematch" && revealShownRef.current) {
            navigateToGameOver(revealWinnerRef.current);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (!mounted) return;
        setWsConnected(false);
        wsRef.current = null;
        // Reconnect shortly; until then the fast poll fallback keeps the game live.
        reconnectTimer = setTimeout(connect, 2500);
      };

      ws.onerror = () => {
        try {
          ws.close();
        } catch {
          // onclose handles retry
        }
      };
    }

    connect();

    return () => {
      mounted = false;
      setWsConnected(false);
      if (reconnectTimer) clearTimeout(reconnectTimer);
      const ws = wsRef.current;
      wsRef.current = null;
      if (ws) {
        ws.onopen = null;
        ws.onmessage = null;
        ws.onclose = null;
        ws.onerror = null;
        try {
          ws.close();
        } catch {
          // already closed
        }
      }
    };
  }, [matchId]);

  // Seat colors: fixed per player for the whole match, by turn order.
  const seatColors = useMemo(() => {
    const map: Record<string, string> = {};
    (gameState?.turnOrder ?? []).forEach((id, i) => {
      map[id] = seatColorFor(i);
    });
    return map;
  }, [gameState?.turnOrder]);

  const colorOf = useCallback(
    (id: string) => seatColors[id] ?? Colors.textMuted,
    [seatColors],
  );

  // Turns a server-reported action into a match-log line. This narrates the
  // steps the diff-based log below can't see (Diamonds banked, Royals
  // summoned, attachments, blocks, discards…) — without it, most of the AI
  // Mage's turn is invisible. Action types the diff log already covers well
  // (attacks, Royal-targeted Clubs, turn changes) are skipped to avoid
  // double entries.
  const describeLastAction = useCallback(
    (la: { actorUserId: string; action: GameActionRequest }, view: PlayerGameView) => {
      const actor = la.actorUserId;
      const a = la.action as GameActionRequest & { blocks?: Record<string, unknown> };
      const selfId = user?.id ?? "";
      const nameOf = (id: string) => (id === selfId ? "You" : (displayNames[id] ?? id.slice(0, 8)));
      const lbl = (id?: string) => (id ? cardLabel(id) : "a card");
      // Name a Royal with its totals from the fresh view; a Royal already gone
      // from the court (destroyed by this very action) falls back to its card.
      const royalIn = (ownerId: string, royalId?: string) => {
        if (!royalId) return "a Royal";
        const r = view.players[ownerId]?.court?.find((x) => x.cardId === royalId);
        return r ? royalStatLabel(r) : cardLabel(royalId);
      };
      const tgt = a.targetPlayerId ?? actor;

      let text: string | null = null;
      switch (a.type) {
        case "play_diamond_to_mine":
          text = `banked ${lbl(a.cardId)} into the Mine`;
          break;
        case "discard_diamond_to_draw":
          text = `discarded ${lbl(a.cardId)} to draw a card`;
          break;
        case "discard_diamond_for_boost":
          text =
            tgt === actor
              ? `burned ${lbl(a.cardId)} for a Vault boost`
              : `burned ${lbl(a.cardId)} to boost ${nameOf(tgt)}'s Vault`;
          break;
        case "discard_to_abyss":
          text = `discarded ${lbl(a.cardId)}`;
          break;
        case "play_royal_to_court":
          text = `summoned ${royalIn(actor, a.cardId)}`;
          break;
        case "attach_heart":
          text = `attached ${lbl(a.heartCardId)} to ${royalIn(tgt, a.targetRoyalId)}`;
          break;
        case "attach_spade":
          text = `attached ${lbl(a.spadeCardId)} to ${royalIn(tgt, a.targetRoyalId)}`;
          break;
        case "discard_heart_to_heal":
          text =
            tgt === actor
              ? `used ${lbl(a.heartCardId)} to heal`
              : `used ${lbl(a.heartCardId)} to heal ${nameOf(tgt)}`;
          break;
        case "discard_spade_to_return":
          text = `used ${lbl(a.spadeCardId)} to reclaim ${lbl(a.targetCardId)} from the Abyss`;
          break;
        case "apply_club":
          // Royal-targeted Clubs are narrated by the pendingClubDebuff diff.
          if (!a.targetRoyalId && a.clubCardId) {
            text = `burned ${lbl(a.clubCardId)} — ${parseCardId(a.clubCardId).pipValue} damage to ${nameOf(tgt)}`;
          }
          break;
        case "play_joker":
          text =
            a.mode === "destroy_royal" && a.targetRoyalId
              ? `played a Joker — destroyed ${royalIn(tgt, a.targetRoyalId)}`
              : `played a Joker — 10 damage to ${nameOf(tgt)}`;
          break;
        case "confirm_declare_blocks": {
          const entries = Object.entries(a.blocks ?? {});
          const blocked = entries.filter(([, v]) => Array.isArray(v) && v.length > 0);
          text =
            blocked.length === 0
              ? "chose not to block"
              : blocked
                  .map(
                    ([atkId, v]) =>
                      `blocked ${cardLabel(atkId)} with ${(v as string[]).map(cardLabel).join(" + ")}`,
                  )
                  .join("; ");
          break;
        }
        case "duel_pass":
          text = "passed";
          break;
        case "confirm_club_response":
          text = "let the Club resolve";
          break;
        case "discard_to_end_turn":
          text = `discarded ${lbl(a.cardId)} (hand limit)`;
          break;
        case "end_turn":
          text = "ended their turn";
          break;
        case "set_damage_order":
          text = "chose the damage order";
          break;
        default:
          // declare_attack is narrated by the diff log with full stat labels;
          // interrupt_pass is a legacy no-op.
          break;
      }

      if (text) {
        // ⚡ marks card plays made while someone ELSE holds the turn —
        // interrupts and combat/club reactions — so reactive play is
        // instantly visible in the log.
        const CARD_PLAY_TYPES = new Set([
          "play_diamond_to_mine",
          "discard_diamond_to_draw",
          "discard_diamond_for_boost",
          "discard_to_abyss",
          "attach_heart",
          "attach_spade",
          "discard_heart_to_heal",
          "discard_spade_to_return",
          "apply_club",
          "play_joker",
        ]);
        const offTurn = actor !== view.activePlayerId && CARD_PLAY_TYPES.has(a.type);
        pushEvent(colorOf(actor), text, {
          actor: nameOf(actor),
          tag: offTurn ? "⚡" : undefined,
        });
      }
    },
    [user, displayNames, colorOf, pushEvent],
  );
  logActionRef.current = describeLastAction;

  // Snapshot the duel when it starts; when it ends (or hands off to the next
  // defender in the queue), diff courts + life against the snapshot to
  // produce a human-readable outcome.
  useEffect(() => {
    if (!gameState) return;
    const effectMyId = user?.id ?? "";
    const nameOf = (id: string) =>
      id === effectMyId ? "You" : (displayNames[id] ?? id.slice(0, 8));

    const finalize = (snap: NonNullable<typeof duelSnapshotRef.current>) => {
      const atkName = nameOf(snap.attackerId);
      const defName = nameOf(snap.defenderId);
      const atkCourt = gameState.players[snap.attackerId]?.court ?? [];
      const defCourt = gameState.players[snap.defenderId]?.court ?? [];
      // Name any Royal in the duel with its current effective totals: prefer
      // the live court entry (reflects mid-duel attachments and final combat
      // damage); fall back to the snapshot's last-known stats for a destroyed
      // Royal (the snapshot is refreshed every update while the duel runs, so
      // buffs attached mid-duel are included even for the dead).
      const royalName = (id: string) => {
        const live =
          atkCourt.find((r) => r.cardId === id) ?? defCourt.find((r) => r.cardId === id);
        const s = live ?? snap.stats[id];
        return s ? royalStatLabel(s) : cardLabel(id);
      };
      // The dueling Royals on each side, with their values — so the outcome
      // shows what both duelers were worth going into the fight.
      const atkRoyals = [...new Set(snap.pairs.map((p) => p.attackerCardId))].map(royalName);
      const defRoyals = [...new Set(snap.pairs.flatMap((p) => p.blockerIds))].map(royalName);

      const deadAtk: string[] = [];
      const deadDef: string[] = [];
      for (const p of snap.pairs) {
        if (!atkCourt.some((r) => r.cardId === p.attackerCardId)) deadAtk.push(royalName(p.attackerCardId));
        for (const b of p.blockerIds) {
          if (!defCourt.some((r) => r.cardId === b)) deadDef.push(royalName(b));
        }
      }
      const lines: string[] = [];
      if (atkRoyals.length > 0 || defRoyals.length > 0) {
        lines.push(`${atkRoyals.join(", ") || atkName} vs ${defRoyals.join(", ") || defName}`);
      }
      if (deadDef.length > 0) lines.push(`${defName} lost Royal${deadDef.length > 1 ? "s" : ""} ${deadDef.join(", ")}`);
      if (deadAtk.length > 0) lines.push(`${atkName} lost Royal${deadAtk.length > 1 ? "s" : ""} ${deadAtk.join(", ")}`);
      for (const [pid, prevLife] of Object.entries(snap.lives)) {
        const nowLife = gameState.players[pid]?.life ?? prevLife;
        if (nowLife < prevLife) lines.push(`${nameOf(pid)} took ${prevLife - nowLife} damage (❤ ${nowLife})`);
        else if (nowLife > prevLife) lines.push(`${nameOf(pid)} healed +${nowLife - prevLife} (❤ ${nowLife})`);
      }
      if (lines.length === 0) lines.push("Both sides survived — no losses");
      return { title: `${atkName} vs ${defName}`, lines };
    };

    const snap = duelSnapshotRef.current;
    const ctx = gameState.duelContext;
    let handledByDuelTracker = false;

    if (isDuelTurnPhase(gameState.phase) && ctx) {
      handledByDuelTracker = true;
      const sameDuel =
        snap && snap.attackerId === ctx.attackerPlayerId && snap.defenderId === ctx.defenderPlayerId;
      if (sameDuel) {
        // Keep the snapshot's stats fresh while the duel runs: attachments
        // played mid-duel (Hearts, Spades, Clubs) change a Royal's totals, and
        // the final log must reflect them — including for a Royal that later
        // dies. Only Royals still on the board are refreshed; a destroyed
        // Royal keeps its last-seen stats.
        for (const r of [
          ...(gameState.players[ctx.attackerPlayerId]?.court ?? []),
          ...(gameState.players[ctx.defenderPlayerId]?.court ?? []),
        ]) {
          snap.stats[r.cardId] = {
            cardId: r.cardId,
            buffAttack: r.buffAttack,
            buffHealth: r.buffHealth,
            damageTaken: r.damageTaken,
          };
        }
      } else {
        // Previous duel (if any) handed off to the next defender — record it.
        if (snap) {
          const res = finalize(snap);
          const idn = idCounterRef.current++;
          setCompletedDuels((prev) => [...prev.slice(-3), { id: idn, text: `${res.title}: ${res.lines.join(" · ")}` }]);
          pushEvent(colorOf(snap.attackerId), `Duel resolved — ${res.title}`, {
            sublines: res.lines,
          });
        }
        duelSnapshotRef.current = {
          attackerId: ctx.attackerPlayerId,
          defenderId: ctx.defenderPlayerId,
          pairs: gameState.attacks
            .filter(
              (a) =>
                a.attackerPlayerId === ctx.attackerPlayerId &&
                a.targetPlayerId === ctx.defenderPlayerId &&
                (a.blockerCardIds?.length ?? 0) > 0,
            )
            .map((a) => ({ attackerCardId: a.attackerCardId, blockerIds: [...(a.blockerCardIds ?? [])] })),
          lives: {
            [ctx.attackerPlayerId]: gameState.players[ctx.attackerPlayerId]?.life ?? 0,
            [ctx.defenderPlayerId]: gameState.players[ctx.defenderPlayerId]?.life ?? 0,
          },
          stats: Object.fromEntries(
            [
              ...(gameState.players[ctx.attackerPlayerId]?.court ?? []),
              ...(gameState.players[ctx.defenderPlayerId]?.court ?? []),
            ].map((r) => [
              r.cardId,
              { cardId: r.cardId, buffAttack: r.buffAttack, buffHealth: r.buffHealth, damageTaken: r.damageTaken },
            ]),
          ),
        };
      }
    } else if (snap) {
      // Combat left the duel phases — the last duel is over. Show the result
      // panel (non-blocking, auto-clears) and log it permanently.
      handledByDuelTracker = true;
      const res = finalize(snap);
      duelSnapshotRef.current = null;
      const idn = idCounterRef.current++;
      setDuelNotice({ id: idn, header: "Duel resolved", title: res.title, lines: res.lines });
      pushEvent(colorOf(snap.attackerId), `Duel resolved — ${res.title}`, {
        sublines: res.lines,
      });
      setCompletedDuels([]);
    }

    // Combat that resolved WITHOUT the client ever rendering a duel phase.
    // Three cases produce no duelNotice from the snapshot tracker above:
    //   A) the defender let every attacker through unblocked (no duel exists),
    //   B) blocks were made but both sides had no duel cards, so the engine
    //      auto-resolved the whole fight inside one action, and
    //   C) a mix of the two.
    // In all three the state jumps declare_blocks → main in a single update.
    // Synthesize the same auto-clearing panel from lastCombatSummary so the
    // player always sees what happened. A duel that WAS rendered is skipped
    // here (handledByDuelTracker) — that path already showed the panel.
    // Gate on the phase transition, NOT on lastCombatSummary changing:
    // lastCombatSummary lingers in state across turns, so diffing it would
    // replay the previous combat at the start of a new turn. "We were in a
    // combat phase last render and aren't now" is the reliable signal that a
    // fight just resolved. prevPhaseRef still holds the previous phase here —
    // it's updated by the diff effect, which runs after this one.
    const summary = gameState.lastCombatSummary;
    const prevPhase = prevPhaseRef.current;
    const cameFromCombat =
      prevPhase === "declare_blocks" ||
      prevPhase === "assign_damage_order" ||
      isDuelTurnPhase(prevPhase ?? "");
    const combatResolvedNow =
      gameState.phase !== "declare_blocks" &&
      gameState.phase !== "assign_damage_order" &&
      !isDuelTurnPhase(gameState.phase);
    if (
      cameFromCombat &&
      combatResolvedNow &&
      !handledByDuelTracker &&
      summary &&
      summary.pairs.length > 0
    ) {
      // Pre-combat stats come from the previous snapshot (this effect runs
      // before the diff effect updates prevPlayersRef), so destroyed Royals
      // are still named with the values they died with.
      const prevPlayers = prevPlayersRef.current;
      // Combat always resolves within the attacker's turn.
      const attackerId = gameState.activePlayerId;
      const royalName = (ownerId: string, cardId: string) => {
        const before = prevPlayers[ownerId]?.court.find((r) => r.cardId === cardId);
        return before ? royalStatLabel(before) : cardLabel(cardId);
      };

      const blockedPairs = summary.pairs.filter((p) => (p.blockerCardIds?.length ?? 0) > 0);
      const unblockedPairs = summary.pairs.filter(
        (p) => (p.blockerCardIds?.length ?? 0) === 0 && p.directDamage > 0,
      );
      const anyBlocked = blockedPairs.length > 0;

      const defenderIds = [...new Set(summary.pairs.map((p) => p.targetPlayerId))];
      const title = `${nameOf(attackerId)} vs ${defenderIds.map(nameOf).join(", ")}`;

      const lines: string[] = [];
      // Per-pair narration: how each attacking Royal fared.
      for (const p of blockedPairs) {
        const blockers = p.blockerCardIds.map((b) => royalName(p.targetPlayerId, b)).join(" + ");
        lines.push(`${royalName(attackerId, p.attackerCardId)} — blocked by ${blockers}`);
      }
      for (const p of unblockedPairs) {
        lines.push(
          `${royalName(attackerId, p.attackerCardId)} hit ${nameOf(p.targetPlayerId)} for ${p.directDamage} — unblocked`,
        );
      }
      // Losses (from court diffs) and life deltas.
      for (const p of blockedPairs) {
        if (p.attackerDestroyed) {
          lines.push(`${nameOf(attackerId)} lost Royal ${royalName(attackerId, p.attackerCardId)}`);
        }
        for (const b of p.blockerCardIds) {
          const survived = gameState.players[p.targetPlayerId]?.court.some((r) => r.cardId === b);
          if (!survived) lines.push(`${nameOf(p.targetPlayerId)} lost Royal ${royalName(p.targetPlayerId, b)}`);
        }
      }
      for (const pid of [attackerId, ...defenderIds]) {
        const beforeLife = prevPlayers[pid]?.life;
        const nowLife = gameState.players[pid]?.life;
        if (beforeLife !== undefined && nowLife !== undefined && nowLife !== beforeLife) {
          lines.push(
            nowLife < beforeLife
              ? `${nameOf(pid)} took ${beforeLife - nowLife} damage (❤ ${nowLife})`
              : `${nameOf(pid)} healed +${nowLife - beforeLife} (❤ ${nowLife})`,
          );
        }
      }
      if (lines.length === 0) lines.push("Both sides survived — no losses");

      // Fully auto-resolved duel: the server resolved every blocked pair
      // instantly because neither participant had a playable card, so no
      // duel screen was ever shown. Say so explicitly.
      if (summary.autoResolved) {
        lines.push("Neither player had playable cards — the duel resolved automatically");
      }

      const header = summary.autoResolved
        ? "Duel resolved — auto"
        : anyBlocked
          ? "Combat resolved"
          : "Attack landed — unblocked";
      const idn = idCounterRef.current++;
      setDuelNotice({ id: idn, header, title, lines });
      pushEvent(colorOf(attackerId), `${header} — ${title}`, { sublines: lines });
    }
  }, [gameState]);

  // Suit-themed hit effects (lightning / heal bloom / shard burst / sword)
  // plus their haptics + SFX, derived by diffing snapshots. Kept separate
  // from the ticker diff below — see lib/hitEffectsDiff.ts for the rules.
  const { seatEffects, royalEffects } = useHitEffects(gameState, user?.id ?? "");

  // Cinematic card flights (visual clones only — game state untouched):
  // "cast" when I play a card, "incoming" when attacks are declared at me.
  const [flights, setFlights] = useState<CardFlightEvent[]>([]);
  const flightIdRef = useRef(0);
  const launchFlight = useCallback((cardId: string, kind: CardFlightEvent["kind"]) => {
    const id = ++flightIdRef.current;
    setFlights((cur) => [...cur.slice(-2), { id, cardId, kind }]); // cap 3 live flights
    setTimeout(() => {
      setFlights((cur) => cur.filter((f) => f.id !== id));
    }, CARD_FLIGHT_TTL_MS + 300);
  }, []);

  // Arcane sweep when the turn passes to a new player.
  const [turnFlare, setTurnFlare] = useState<{ key: number; color: string } | null>(null);

  // Sound toggle (persisted in lib/sfx.ts; this state just drives the menu row).
  const [sfxMuted, setSfxMutedState] = useState(getSfxMuted());

  // Load every sound up front — first plays are otherwise fetched from the
  // dev server on demand and can land seconds late.
  useEffect(() => {
    preloadSfx();
  }, []);

  // "YOUR TURN" proclamation, keyed so each of my turns replays it once.
  const [yourTurnKey, setYourTurnKey] = useState<number | null>(null);

  // Incoming-attack lunge: when a fresh combat opens against me, dive the
  // attacker cards toward my seat (visual only; capped at 3). The same
  // phase-watcher also cues the duel start/end sounds for the two duelists.
  const prevAttackPhaseRef = useRef<string>("");
  const prevDuelDefenderRef = useRef<string | null>(null);
  const wasDuelParticipantRef = useRef(false);
  useEffect(() => {
    if (!gameState) return;
    const localMyId = user?.id ?? "";
    const prevPhase = prevAttackPhaseRef.current;
    if (gameState.phase === "declare_blocks" && prevPhase !== "declare_blocks") {
      const incoming = gameState.attacks
        .filter((a) => a.targetPlayerId === localMyId)
        .slice(0, 3);
      incoming.forEach((a) => launchFlight(a.attackerCardId, "incoming"));
      // War-drum for everyone being attacked. The attacker already heard it
      // optimistically at press time (handleAttack); bystanders stay quiet.
      const amTargeted = gameState.attacks.some((a) => a.targetPlayerId === localMyId);
      if (amTargeted) playGameSfx("attack");
    }

    // Duel start/end sounds — participants only, and only on the natural
    // transitions: interrupt/club-response windows that interpose mid-duel
    // must not re-trigger either sound.
    const inDuelPhase =
      gameState.phase === "duel_attacker_turn" || gameState.phase === "duel_blocker_turn";
    const duelSoundCtx = gameState.duelContext;
    const amDuelist =
      !!duelSoundCtx &&
      (localMyId === duelSoundCtx.attackerPlayerId || localMyId === duelSoundCtx.defenderPlayerId);
    if (inDuelPhase && duelSoundCtx) {
      const enteredNaturally =
        prevPhase === "declare_blocks" || prevPhase === "assign_damage_order";
      const nextDuelInQueue =
        prevDuelDefenderRef.current !== null &&
        prevDuelDefenderRef.current !== duelSoundCtx.defenderPlayerId;
      if ((enteredNaturally || nextDuelInQueue) && amDuelist) {
        playGameSfx("duelStart");
      }
      prevDuelDefenderRef.current = duelSoundCtx.defenderPlayerId;
      wasDuelParticipantRef.current = amDuelist;
    } else if (
      (gameState.phase === "main" || gameState.phase === "draw") &&
      (prevPhase === "duel_attacker_turn" || prevPhase === "duel_blocker_turn")
    ) {
      if (wasDuelParticipantRef.current) playGameSfx("duelEnd");
      prevDuelDefenderRef.current = null;
      wasDuelParticipantRef.current = false;
    }

    prevAttackPhaseRef.current = gameState.phase;
  }, [gameState, user, launchFlight]);

  // Diff-based match log + damage/combat notices. This replaces the old
  // fade-away combat banner: everything lands in the persistent ticker, and
  // big moments also toast.
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const prevPlayers = prevPlayersRef.current;
    const effectMyId = user?.id ?? "";
    const nameOf = (id: string) =>
      id === effectMyId ? "You" : (displayNames[id] ?? id.slice(0, 8));
    // Possessive that reads naturally for "You": "your" vs "Bob's".
    const possOf = (id: string) => (id === effectMyId ? "your" : `${nameOf(id)}'s`);
    // Possessive when the owner is also the actor: "your own" / "Bob's own".
    const ownPossOf = (id: string) => (id === effectMyId ? "your own" : `${nameOf(id)}'s own`);
    // A Royal named with its effective totals, e.g. "K♥ (⚔10 ♥4)". Falls back to
    // the previous snapshot when the Royal has already left the court, so a card
    // is never logged without its value.
    const royalLabel = (playerId: string, royalCardId: string) => {
      const royal =
        gameState.players[playerId]?.court.find((r) => r.cardId === royalCardId) ??
        prevPlayers[playerId]?.court.find((r) => r.cardId === royalCardId);
      return royal ? royalStatLabel(royal) : cardLabel(royalCardId);
    };

    // Turn changes.
    if (prevActivePlayerRef.current && prevActivePlayerRef.current !== gameState.activePlayerId) {
      pushEvent(colorOf(gameState.activePlayerId), `— turn ${gameState.turnNumber}`, {
        actor: nameOf(gameState.activePlayerId),
      });
      const flareKey = gameState.turnNumber * 100 + gameState.turnOrder.indexOf(gameState.activePlayerId);
      setTurnFlare({ key: flareKey, color: colorOf(gameState.activePlayerId) });
      if (gameState.activePlayerId === effectMyId) {
        // The pass-of-turn should be unmissable: banner + chime + buzz.
        setYourTurnKey(flareKey);
        playGameSfx("turn");
        if (Platform.OS !== "web") {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        }
      }
    }
    prevActivePlayerRef.current = gameState.activePlayerId;

    // Attack declarations (entering declare_blocks) — a fresh combat begins,
    // so clear last combat's duel tracker and result panel.
    if (prev !== "declare_blocks" && gameState.phase === "declare_blocks") {
      setCompletedDuels([]);
      setDuelNotice(null);
      const byAttacker = new Map<string, Map<string, string[]>>();
      for (const a of gameState.attacks) {
        const inner = byAttacker.get(a.attackerPlayerId) ?? new Map<string, string[]>();
        inner.set(a.targetPlayerId, [...(inner.get(a.targetPlayerId) ?? []), a.attackerCardId]);
        byAttacker.set(a.attackerPlayerId, inner);
      }
      for (const [atkId, targets] of byAttacker) {
        for (const [tgtId, cardIds] of targets) {
          const royals = cardIds.map((cid) => royalLabel(atkId, cid)).join(", ");
          pushEvent(colorOf(atkId), `attacked ${nameOf(tgtId)} with ${royals}`, {
            actor: nameOf(atkId),
          });
        }
      }
    }

    // Club plays.
    const pendingClubKey = gameState.pendingClubDebuff
      ? `${gameState.pendingClubDebuff.clubCardId}:${gameState.pendingClubDebuff.targetRoyalId}`
      : null;
    if (pendingClubKey && pendingClubKey !== prevPendingClubRef.current && gameState.pendingClubDebuff) {
      const c = gameState.pendingClubDebuff;
      const clubTargetPoss =
        c.attackerPlayerId === c.targetPlayerId ? ownPossOf(c.attackerPlayerId) : possOf(c.targetPlayerId);
      // Stats read here are pre-debuff: the play is still pending when this fires.
      const clubPip = parseCardId(c.clubCardId).pipValue;
      pushEvent(
        colorOf(c.attackerPlayerId),
        `played ${cardLabel(c.clubCardId)} (−${clubPip}) on ${clubTargetPoss} Royal ${royalLabel(c.targetPlayerId, c.targetRoyalId)}`,
        { actor: nameOf(c.attackerPlayerId) },
      );
    }
    prevPendingClubRef.current = pendingClubKey;

    const wasDuel = prev === "duel_attacker_turn" || prev === "duel_blocker_turn";
    const wasCombat = wasDuel || prev === "declare_blocks" || prev === "assign_damage_order";
    const nowResolved = gameState.phase === "main" || gameState.phase === "draw";
    const enteredDuelFromBlocks =
      prev === "declare_blocks" &&
      (gameState.phase === "duel_blocker_turn" ||
        gameState.phase === "duel_attacker_turn" ||
        gameState.phase === "assign_damage_order");

    // Detailed life-event feed from the server: one ticker line per hit or
    // heal, with the source card, amount, and resulting life. Because each
    // event carries its own seq, back-to-back hits on the same player are
    // never merged into one confusing delta.
    const allLifeEvents = gameState.lifeEvents ?? [];
    const maxLifeEventSeq = allLifeEvents.length
      ? allLifeEvents[allLifeEvents.length - 1]!.seq
      : 0;
    let newLifeEvents: typeof allLifeEvents = [];
    if (seenLifeEventSeqRef.current === null) {
      // First snapshot (or rejoin): don't replay events from before we joined.
      seenLifeEventSeqRef.current = maxLifeEventSeq;
    } else {
      const watermark = seenLifeEventSeqRef.current;
      newLifeEvents = allLifeEvents.filter((ev) => ev.seq > watermark);
      seenLifeEventSeqRef.current = Math.max(watermark, maxLifeEventSeq);
    }
    // Players whose life changes this snapshot are already covered by
    // detailed event lines — skip the generic fallback diff for them.
    const detailedLifeIds = new Set<string>();
    const detailedElimIds = new Set<string>();
    for (const ev of newLifeEvents) {
      if (ev.kind === "elimination") {
        // Detailed elimination line: resulting life is always shown so the
        // knockout reads in sequence with the lethal hit right before it.
        detailedElimIds.add(ev.targetPlayerId);
        pushEvent(
          colorOf(ev.targetPlayerId),
          `${ev.targetPlayerId === effectMyId ? "were" : "was"} eliminated (❤ ${ev.resultingLife})`,
          { actor: nameOf(ev.targetPlayerId), tag: "☠" },
        );
        continue;
      }
      detailedLifeIds.add(ev.targetPlayerId);
      const source = ev.sourceCardId ? cardLabel(ev.sourceCardId) : undefined;
      if (ev.kind === "heal") {
        const healer =
          ev.actorPlayerId && ev.actorPlayerId !== ev.targetPlayerId
            ? ` by ${nameOf(ev.actorPlayerId)}`
            : "";
        pushEvent(
          colorOf(ev.targetPlayerId),
          `healed +${ev.amount}${source ? ` with ${source}` : ""}${healer} (❤ ${ev.resultingLife})`,
          { actor: nameOf(ev.targetPlayerId) },
        );
      } else {
        const from = source
          ? ` from ${ev.actorPlayerId ? `${possOf(ev.actorPlayerId)} ` : ""}${source}`
          : "";
        pushEvent(
          colorOf(ev.targetPlayerId),
          `took ${ev.amount} damage${from} (❤ ${ev.resultingLife})`,
          { actor: nameOf(ev.targetPlayerId) },
        );
      }
    }

    // Life / court / elimination diffs → ticker (+ toast for big combat hits).
    const damageParts: string[] = [];
    for (const [id, p] of Object.entries(gameState.players)) {
      const before = prevPlayers[id];
      if (!before) continue;
      const lifeDelta = p.life - before.life;
      if (lifeDelta < 0) {
        if (!detailedLifeIds.has(id)) {
          pushEvent(colorOf(id), `took ${-lifeDelta} damage (❤ ${p.life})`, { actor: nameOf(id) });
        }
        damageParts.push(`${nameOf(id)} took ${-lifeDelta} damage`);
      } else if (lifeDelta > 0) {
        if (!detailedLifeIds.has(id)) {
          pushEvent(colorOf(id), `healed +${lifeDelta} (❤ ${p.life})`, { actor: nameOf(id) });
        }
      }
      const nowCourtIds = new Set(p.court.map((r) => r.cardId));
      const lostRoyals = before.court.filter((r) => !nowCourtIds.has(r.cardId));
      if (lostRoyals.length > 0) {
        const lostNames = lostRoyals.map(royalStatLabel).join(", ");
        pushEvent(colorOf(id), `lost Royal${lostRoyals.length > 1 ? "s" : ""} ${lostNames}`, {
          actor: nameOf(id),
        });
        damageParts.push(`${nameOf(id)} lost ${lostNames}`);
      }
      if (!before.eliminated && p.isEliminated) {
        // Fallback line only for matches persisted before lifeEvents existed;
        // otherwise the detailed elimination line above already covered it.
        if (!detailedElimIds.has(id)) {
          pushEvent(colorOf(id), `${id === effectMyId ? "were" : "was"} eliminated!`, {
            actor: nameOf(id),
            tag: "☠",
          });
        }
        // Prominent overlay (replaces the old easy-to-miss toast). The server
        // records how many cards were swept; fall back to the pre-diff court
        // size for matches persisted before lastEliminations existed.
        const elimEvent = (gameState.lastEliminations ?? [])
          .filter((e) => e.playerId === id)
          .pop();
        setElimNotice({
          id: idCounterRef.current++,
          playerId: id,
          sweptCount: elimEvent?.sweptCardIds?.length ?? before.court.length,
        });
      }
    }

    // Direct (non-combat) damage — a burned Club or a Joker's damage mode.
    // Toast it with the card, victim, and amount so face damage is never
    // just a silently shrinking life number.
    const dh = gameState.lastDirectHit;
    if (dh) {
      if (seenDirectHitSeqRef.current === null) {
        // First snapshot (or rejoin): don't replay a hit from before we joined.
        seenDirectHitSeqRef.current = dh.seq;
      } else if (dh.seq > seenDirectHitSeqRef.current) {
        seenDirectHitSeqRef.current = dh.seq;
        const victimLife = gameState.players[dh.targetPlayerId]?.life;
        showToast(
          `💥 ${cardLabel(dh.sourceCardId)} hit ${nameOf(dh.targetPlayerId)} for ${dh.amount}${victimLife !== undefined ? ` (❤ ${victimLife})` : ""}`,
          "info",
        );
      }
    }

    if (enteredDuelFromBlocks && damageParts.length > 0) {
      showToast(damageParts.join(" · "), "info");
    }

    if (wasCombat && nowResolved) {
      const autoPassedIds = gameState.lastCombatSummary?.autoPassedPlayerIds ?? [];
      if (autoPassedIds.length > 0) {
        const bothPlayers = autoPassedIds.length >= 2;
        let message: string;
        if (bothPlayers) {
          message = "No cards left to play — combat resolved";
        } else {
          const passedId = autoPassedIds[0]!;
          const localMyId = user?.id ?? "";
          message = passedId === localMyId
            ? "You had no cards to play"
            : `${displayNames[passedId] ?? passedId.slice(0, 8)} had no cards to play`;
        }

        // After a duel the result panel carries the details — toast only the
        // auto-pass reason. Unblocked-only combat still toasts its damage.
        showToast(wasDuel ? message : [message, ...damageParts].join(" · "), "info");
      } else if (damageParts.length > 0 && !wasDuel) {
        showToast(`⚔ ${damageParts.join(" · ")}`, "info");
      }
    }

    prevPhaseRef.current = gameState.phase;
    prevPlayersRef.current = Object.fromEntries(
      Object.entries(gameState.players).map(([id, p]) => [
        id,
        {
          life: p.life,
          court: p.court.map((r) => ({
            cardId: r.cardId,
            buffAttack: r.buffAttack,
            buffHealth: r.buffHealth,
            damageTaken: r.damageTaken,
          })),
          eliminated: !!p.isEliminated,
        },
      ]),
    );
  }, [gameState]);

  // Clear selected card when entering respond_to_club or duel phases;
  // reset attack machinery when leaving main.
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === "respond_to_club" || isDuelTurnPhase(gameState.phase)) {
      setSelectedCardId(null);
      setAbyssPickerAction(null);
      setArmedAction(null);
    }
    if (gameState.phase !== "main") {
      setAttackSelectMode(false);
      setSelectedAttackRoyalIds(new Set());
      setAssigningTargets(false);
      setTargetAssignments({});
      setActiveAssignRoyalId(null);
    }
  }, [gameState?.phase]);

  const { mutate: abandonMatchMutate } = useAbandonMatch({
    mutation: {
      onSuccess: () => {
        // Abandon has no winner — exit straight to results, no reveal.
        beginGameOver(null);
      },
      onError: () => {
        showToast("Couldn't end the game — please try again", "error");
      },
    },
  });

  const handleAbandon = useCallback(() => {
    setShowMenu(false);
    Alert.alert(
      "End Game",
      "This will end the match for all players. Are you sure?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "End Game",
          style: "destructive",
          onPress: () => {
            if (matchId) abandonMatchMutate({ matchId });
          },
        },
      ],
    );
  }, [matchId, abandonMatchMutate]);

  const { mutate: submitAction, isPending: isSubmitting } = useSubmitGameAction({
    mutation: {
      onSuccess: (data) => {
        setGameState(data.state);
        setSelectedCardId(null);
        setAbyssPickerAction(null);
        setArmedAction(null);
        setAttackSelectMode(false);
        setSelectedAttackRoyalIds(new Set());
        setAssigningTargets(false);
        setTargetAssignments({});
        setActiveAssignRoyalId(null);
        if (data.winnerUserId) {
          beginGameOver(data.winnerUserId);
        }
      },
      onError: (err) => {
        const errObj = err as {
          data?: { error?: string } | string | null;
          message?: string;
          status?: number;
          statusText?: string;
        };
        let msg: string | undefined;
        if (errObj?.data && typeof errObj.data === "object" && typeof errObj.data.error === "string") {
          msg = errObj.data.error;
        } else if (typeof errObj?.data === "string" && errObj.data.trim()) {
          msg = errObj.data.trim();
        } else if (typeof errObj?.message === "string" && errObj.message.trim()) {
          msg = errObj.message.trim();
        }
        if (!msg) {
          msg = errObj?.status
            ? `That didn't go through (HTTP ${errObj.status}${errObj.statusText ? " " + errObj.statusText : ""})`
            : "That didn't go through — couldn't reach the server";
        }
        showToast(msg, "error");
      },
    },
  });

  const handleAction = useCallback(
    (params: ActionParams) => {
      if (!matchId) return;

      const myIdLocal = user?.id ?? "";
      const phase = gameState?.phase ?? "";
      const inDuel = isDuelTurnPhase(phase);
      const duelCtx = gameState?.duelContext;

      const actingAsDefender =
        phase === "declare_blocks" &&
        gameState?.attacks.some((a) => a.targetPlayerId === myIdLocal);
      const actingAsClubResponder =
        phase === "respond_to_club" &&
        gameState?.pendingClubDebuff?.targetPlayerId === myIdLocal;
      const actingAsDuelParticipant =
        inDuel && duelCtx &&
        (myIdLocal === duelCtx.attackerPlayerId || myIdLocal === duelCtx.defenderPlayerId);
      const actingAsInterrupter =
        phase === "interrupt_window" &&
        gameState?.interruptStack?.priorityPlayerId === myIdLocal;
      // A non-active bystander may open a fresh interrupt window during any
      // other player's turn/phase. The server validates the specific action
      // (and rejects ineligible ones), so we only need a coarse gate here.
      const actingAsInterruptInitiator =
        !!gameState &&
        gameState.activePlayerId !== myIdLocal &&
        phase !== "interrupt_window" &&
        !actingAsDefender &&
        !actingAsClubResponder &&
        !actingAsDuelParticipant &&
        !gameState.players?.[myIdLocal]?.isEliminated;

      if (
        gameState?.activePlayerId !== myIdLocal &&
        !actingAsDefender &&
        !actingAsClubResponder &&
        !actingAsDuelParticipant &&
        !actingAsInterrupter &&
        !actingAsInterruptInitiator
      ) {
        showToast("The turn has moved on — hang tight", "error");
        setSelectedCardId(null);
        return;
      }

      const handOnlyActions: CardAction[] = [
        "attach_royal_support", "attach_heart", "attach_spade",
        "discard_heart_to_heal", "discard_spade_to_return",
        "apply_club", "apply_club_damage", "play_joker",
        "discard_to_abyss",
        "play_diamond_to_mine", "discard_diamond_to_draw",
        "discard_diamond_for_boost", "play_royal_to_court",
        "discard_to_end_turn",
      ];
      if (handOnlyActions.includes(params.action as CardAction)) {
        const hand = gameState?.myHand ?? [];
        if (!hand.includes(params.cardId)) {
          showToast("That card is no longer in your hand", "error");
          setSelectedCardId(null);
          return;
        }
      }

      let body: GameActionRequest;
      switch (params.action) {
        case "attach_royal_support":
          body = {
            type: "attach_royal_support",
            supportCardId: params.cardId,
            targetRoyalId: params.targetRoyalId!,
          };
          break;
        case "attach_heart":
          body = {
            type: "attach_heart",
            heartCardId: params.cardId,
            targetRoyalId: params.targetRoyalId!,
            targetPlayerId: params.targetPlayerId,
          };
          break;
        case "attach_spade":
          body = {
            type: "attach_spade",
            spadeCardId: params.cardId,
            targetRoyalId: params.targetRoyalId!,
            targetPlayerId: params.targetPlayerId,
          };
          break;
        case "discard_heart_to_heal":
          body = {
            type: "discard_heart_to_heal",
            heartCardId: params.cardId,
            targetPlayerId: params.targetPlayerId,
          };
          break;
        case "discard_spade_to_return":
          body = {
            type: "discard_spade_to_return",
            spadeCardId: params.cardId,
            targetCardId: params.targetCardId!,
          };
          break;
        case "apply_club":
          body = {
            type: "apply_club",
            clubCardId: params.cardId,
            targetPlayerId: params.targetPlayerId!,
            targetRoyalId: params.targetRoyalId!,
          };
          break;
        case "play_joker":
          body = {
            type: "play_joker",
            cardId: params.cardId,
            mode: params.mode as GameActionRequest["mode"],
            targetRoyalId: params.targetRoyalId,
            targetPlayerId: params.targetPlayerId,
          };
          break;
        case "discard_to_abyss":
          body = { type: "discard_to_abyss", cardId: params.cardId };
          break;
        case "apply_club_damage":
          body = {
            type: "apply_club",
            clubCardId: params.cardId,
            targetPlayerId: params.targetPlayerId!,
          };
          break;
        case "discard_diamond_for_boost":
          body = {
            type: "discard_diamond_for_boost",
            cardId: params.cardId,
            targetPlayerId: params.targetPlayerId,
          };
          break;
        default:
          body = {
            type: params.action as GameActionRequest["type"],
            cardId: params.cardId,
          };
      }
      // Visual-only: the played card arcs from the hand onto the board.
      launchFlight(params.cardId, "cast");
      // Remember that WE cast this card so the resulting hit effect is
      // audible on this device (see isAudibleToMe in lib/hitEffects.ts).
      markLocalCast(params.cardId);
      submitAction({ matchId, data: body });
    },
    [matchId, gameState, user, submitAction, showToast, launchFlight],
  );

  const handleEndTurn = useCallback(() => {
    if (!matchId) return;
    buzzAction();
    submitAction({ matchId, data: { type: "end_turn" } });
  }, [matchId, submitAction]);

  const handleConfirmClubResponse = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "confirm_club_response" } });
  }, [matchId, submitAction]);

  const handleAttack = useCallback((targets: { targetPlayerId: string; royalCardIds: string[] }[]) => {
    if (!matchId || targets.length === 0) return;
    buzzAction();
    // The attacker hears the war drum at press time (no server round trip);
    // the targets hear it when the declare_blocks snapshot lands.
    playGameSfx("attack");
    submitAction({
      matchId,
      data: { type: "declare_attack", targets },
    });
    setAttackSelectMode(false);
    setSelectedAttackRoyalIds(new Set());
    setAssigningTargets(false);
    setTargetAssignments({});
    setActiveAssignRoyalId(null);
  }, [matchId, submitAction]);

  const handleConfirmBlocks = useCallback((blocks: Record<string, string[]>) => {
    if (!matchId) return;
    const converted: Record<string, string | string[]> = {};
    for (const [atkId, blkIds] of Object.entries(blocks)) {
      converted[atkId] = blkIds.length === 0 ? "pass" : blkIds;
    }
    if (__DEV__) {
      console.log("[blocks] confirm_declare_blocks payload:", JSON.stringify(converted));
    }
    submitAction({ matchId, data: { type: "confirm_declare_blocks", blocks: converted as Record<string, string> } });
  }, [matchId, submitAction]);

  const handleSetDamageOrder = useCallback((assignments: Record<string, string[]>) => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "set_damage_order", assignments } as unknown as GameActionRequest });
  }, [matchId, submitAction]);

  const handleDuelPass = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "duel_pass" } });
  }, [matchId, submitAction]);

  if (isLoading && !gameState) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={Gradients.sanctumDeep} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.brand} />
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  if (!gameState) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={Gradients.sanctumDeep} style={StyleSheet.absoluteFill} />
        <Text style={styles.errorText}>Could not load game state.</Text>
        <Pressable onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  const myId = user?.id ?? "";
  const myState: PublicPlayerState | undefined = gameState.players[myId];
  const opponents = gameState.turnOrder
    .filter((id) => id !== myId)
    .map((id) => gameState.players[id])
    .filter((p): p is PublicPlayerState => !!p);

  const isMyTurn = gameState.activePlayerId === myId;
  const phase = gameState.phase;
  const inMainPhase = phase === "main";
  const inDeclareBlocks = phase === "declare_blocks";
  const inRespondToClub = phase === "respond_to_club";
  const inAssignDamageOrder = phase === "assign_damage_order";
  const inDuel = isDuelTurnPhase(phase);
  const attacksTargetingMe = gameState.attacks.filter((a) => a.targetPlayerId === myId);
  const pendingBlockDefenders = gameState.pendingBlockDefenders;
  const stillNeedToSubmitBlocks = pendingBlockDefenders
    ? pendingBlockDefenders.includes(myId)
    : attacksTargetingMe.length > 0;
  const isDefender = inDeclareBlocks && attacksTargetingMe.length > 0 && stillNeedToSubmitBlocks;

  const duelCtx = gameState.duelContext;
  const isMyDuelTurn = inDuel && duelCtx && (
    (phase === "duel_attacker_turn" && myId === duelCtx.attackerPlayerId) ||
    (phase === "duel_blocker_turn" && myId === duelCtx.defenderPlayerId)
  );
  const inInterrupt = isInterruptPhase(phase);
  const interruptStack = gameState.interruptStack;
  const isMyInterruptTurn = inInterrupt && interruptStack?.priorityPlayerId === myId;

  const pendingClub = gameState.pendingClubDebuff;
  const isClubResponder = inRespondToClub && pendingClub?.targetPlayerId === myId;
  const targetedClubRoyal = pendingClub
    ? gameState.players[pendingClub.targetPlayerId]?.court.find(
        (r) => r.cardId === pendingClub.targetRoyalId,
      )
    : undefined;

  const vault = myState?.vault.available ?? 0;

  // See canPlayerInitiateInterrupt for the duel-aware initiation rules.
  const amIEliminated = myState?.isEliminated ?? false;
  const canInitiateInterrupt = canPlayerInitiateInterrupt({
    inDuel,
    isMyTurn,
    isMyDuelTurn: !!isMyDuelTurn,
    isDefender,
    isClubResponder,
    inInterrupt,
    amIEliminated,
  });

  const inDiscardPhase = isMyTurn && phase === "discard";
  const discardCount = inDiscardPhase ? Math.max(0, (gameState.myHand ?? []).length - 7) : 0;

  const canEndTurn = isMyTurn && (inMainPhase || phase === "end_turn") && !inDiscardPhase && !attackSelectMode;

  const eligibleAttackers = (myState?.court ?? []).filter((r) => !r.hasAttackedThisTurn && !r.hasteLocked);
  const hasEligibleAttackers = eligibleAttackers.length > 0;
  const showAttackButton = isMyTurn && inMainPhase && hasEligibleAttackers && !gameState.hasAttackedThisTurn && !attackSelectMode;

  const showBlockPanel = isDefender;
  const waitingOnOtherDefenders =
    inDeclareBlocks && attacksTargetingMe.length > 0 && !stillNeedToSubmitBlocks;
  const showDamageOrderModal = inAssignDamageOrder && duelCtx && myId === duelCtx.attackerPlayerId;
  const showDuelStage = inDuel && !!duelCtx;

  const nameFor = (id: string) =>
    id === myId ? "You" : (displayNames[id] ?? id.slice(0, 8));
  const possFor = (id: string) => (id === myId ? "your" : `${nameFor(id)}'s`);
  const activePlayerName = nameFor(gameState.activePlayerId);
  const clubAttackerName = pendingClub ? nameFor(pendingClub.attackerPlayerId) : "";
  const clubDefenderName = pendingClub ? nameFor(pendingClub.targetPlayerId) : "";

  // ---- Who is the game waiting on? One rule for every seat's ring/chip. ----
  const waitingOn: Record<string, string> = {};
  if (inDuel && duelCtx) {
    const holder = phase === "duel_attacker_turn" ? duelCtx.attackerPlayerId : duelCtx.defenderPlayerId;
    waitingOn[holder] = "DUELING";
  } else if (inDeclareBlocks) {
    const defenders = pendingBlockDefenders ?? Array.from(new Set(gameState.attacks.map((a) => a.targetPlayerId)));
    for (const d of defenders) waitingOn[d] = "BLOCKING";
  } else if (inRespondToClub && pendingClub) {
    waitingOn[pendingClub.targetPlayerId] = "RESPONDING";
  } else if (inAssignDamageOrder && duelCtx) {
    waitingOn[duelCtx.attackerPlayerId] = "ORDERING";
  } else if (inInterrupt && interruptStack?.priorityPlayerId) {
    waitingOn[interruptStack.priorityPlayerId] = "INTERRUPT";
  } else {
    waitingOn[gameState.activePlayerId] = "PLAYING";
  }

  // ---- Selected-card targeting (the board becomes the menu). ----
  const hasTakenDiamondAction = isMyDuelTurn && duelCtx
    ? (myId === duelCtx.attackerPlayerId ? !!duelCtx.attackerDiamondUsed : !!duelCtx.defenderDiamondUsed)
    : isClubResponder
      ? !!(pendingClub?.defenderDiamondUsed)
      : (gameState.myDiamondPlayed ?? false);

  const anyCourtHasRoyals =
    (myState?.court.length ?? 0) > 0 ||
    Object.values(gameState.players).some((p) => p.id !== myId && p.court.length > 0);

  // Authoritative per-card playability for the hand's muting — a card is
  // playable iff getValidActionsForCard yields at least one enabled action.
  // Same logic that drives the action dock, so hand muting and the dock never
  // disagree.
  const canPlayHandCard = (cardId: string): boolean => {
    const c = parseCardId(cardId);
    return getValidActionsForCard(
      c,
      phase,
      isMyTurn,
      myState?.court.length ?? 0,
      vault,
      hasTakenDiamondAction,
      isDefender,
      isClubResponder,
      !!isMyDuelTurn,
      !!isMyInterruptTurn,
      canInitiateInterrupt,
      anyCourtHasRoyals,
    ).some((a) => !a.disabled);
  };

  const selectedCard = selectedCardId ? parseCardId(selectedCardId) : null;
  const selectedActions: ValidAction[] = selectedCard
    ? getValidActionsForCard(
        selectedCard,
        phase,
        isMyTurn,
        myState?.court.length ?? 0,
        vault,
        hasTakenDiamondAction,
        isDefender,
        isClubResponder,
        !!isMyDuelTurn,
        !!isMyInterruptTurn,
        canInitiateInterrupt,
        anyCourtHasRoyals,
      )
    : [];

  const royalTargetAction = selectedActions.find((a) => !a.disabled && a.targetType === "any_royal");
  const playerTargetAction = selectedActions.find((a) => !a.disabled && a.targetType === "any_player");

  // Spades: attach should be the DEFAULT (tap a glowing Royal, like Hearts /
  // Clubs), with Reclaim as the only explicit chip. Without this carve-out
  // the reclaim option's pick_abyss targetType flips the card into all-chips
  // mode and attach needs an extra tap.
  const abyssChipAction = selectedActions.find((a) => !a.disabled && a.targetType === "pick_abyss");
  const isSpadeLike = !!royalTargetAction && !!abyssChipAction;

  // Cards that also offer instant (no-target) options — Diamonds (Mine/Draw),
  // Royals (to Court), or disabled info rows — surface EVERY option as a dock
  // chip so nothing hides behind a tap-a-target hint. Tapping a targeted chip
  // "arms" it (setArmedAction) and the board highlights its legal targets.
  // Pure-target cards (Hearts/Spades/Clubs/Joker) keep the faster model: no
  // chips, just tap a glowing target directly.
  const hasInstantChips =
    !isSpadeLike &&
    selectedActions.some(
      (a) => a.disabled || !a.requiresTarget || a.targetType === "pick_abyss",
    );

  const dockChipActions = armedAction
    ? []
    : isSpadeLike
      ? // Reclaim only — and only when there is something in the Abyss to take.
        (gameState.abyss.length > 0 && abyssChipAction ? [abyssChipAction] : [])
      : hasInstantChips
        ? selectedActions
        : [];

  const dockTargetHints = armedAction
    ? [targetHintFor(armedAction, selectedCard?.pipValue ?? 0) ?? "Tap a target on the board"]
    : isSpadeLike
      ? [targetHintFor(royalTargetAction!, selectedCard?.pipValue ?? 0)].filter(
          (h): h is string => !!h,
        )
      : hasInstantChips
        ? []
        : selectedActions
            .filter((a) => !a.disabled && (a.targetType === "any_royal" || a.targetType === "any_player"))
            .map((a) => targetHintFor(a, selectedCard?.pipValue ?? 0))
            .filter((h): h is string => !!h);

  // Which action a board tap resolves to: the armed chip if present, otherwise
  // the auto-derived target action (only for pure-target cards).
  const activeRoyalAction =
    armedAction?.targetType === "any_royal" ? armedAction : (hasInstantChips ? undefined : royalTargetAction);
  const activePlayerAction =
    armedAction?.targetType === "any_player" ? armedAction : (hasInstantChips ? undefined : playerTargetAction);

  const selectedCardBlockedReason = selectedCard && selectedActions.length === 0
    ? (amIEliminated
        ? "You've been eliminated — you're spectating now."
        : !isMyTurn && !isDefender && !isClubResponder && !isMyDuelTurn && !isMyInterruptTurn && !canInitiateInterrupt
        ? "It's not your turn — wait for your move."
        : isClubResponder && selectedCard.isRoyal
        ? "Royals can't be played while responding to a Club."
        : (isDefender && (selectedCard.isRoyal || selectedCard.suit === "D"))
        ? "Royals and Diamonds can't be played while blocking."
        : (isMyDuelTurn || isMyInterruptTurn || canInitiateInterrupt) && selectedCard.isRoyal
        ? "Royals can't be played right now — only spells, Diamonds and Jokers."
        : selectedCard.isJoker && vault < 10
        ? `The Joker costs ⚡10 — you have ⚡${vault}.`
        : (isMyDuelTurn || canInitiateInterrupt) && selectedCard.suit === "D" && hasTakenDiamondAction
        ? "You've already used a Diamond this turn."
        : phase !== "main" && isMyTurn
        ? `Cards can't be played during ${PHASE_LABELS[phase]?.toLowerCase() ?? phase}.`
        : "This card has no legal play right now.")
    : null;

  const targetingRoyals = !!activeRoyalAction;
  const targetingPlayers = !!activePlayerAction || (assigningTargets && !!activeAssignRoyalId);

  // ---- Interaction handlers (targeting model) ----
  const handleCardPress = (cardId: string) => {
    if (attackSelectMode) return;
    buzzSelect();
    if (inDiscardPhase) {
      handleAction({ cardId, action: "discard_to_end_turn" });
      return;
    }
    setAbyssPickerAction(null);
    setArmedAction(null);
    setSelectedCardId((prev) => (prev === cardId ? null : cardId));
  };

  const dispatchRoyalTarget = (targetPlayerId: string, targetRoyalId: string) => {
    if (!selectedCardId || !activeRoyalAction) return;
    buzzAction();
    if (selectedCard?.isJoker) {
      handleAction({
        cardId: selectedCardId,
        action: "play_joker",
        mode: "destroy_royal",
        targetPlayerId,
        targetRoyalId,
      });
    } else {
      handleAction({
        cardId: selectedCardId,
        action: activeRoyalAction.action,
        targetPlayerId,
        targetRoyalId,
      });
    }
    setSelectedCardId(null);
  };

  const dispatchPlayerTarget = (targetPlayerId: string) => {
    if (assigningTargets && activeAssignRoyalId) {
      // Attack targeting: send the currently-picked Royal at this seat.
      if (gameState.players[targetPlayerId]?.isEliminated) return;
      if (targetPlayerId === myId) return;
      buzzSelect();
      setTargetAssignments((prev) => {
        const next = { ...prev, [activeAssignRoyalId]: targetPlayerId };
        const remainingUnassigned = Array.from(selectedAttackRoyalIds).find((id) => !next[id]);
        setActiveAssignRoyalId(remainingUnassigned ?? null);
        return next;
      });
      return;
    }
    if (!selectedCardId || !activePlayerAction) return;
    buzzAction();
    if (selectedCard?.isJoker) {
      handleAction({
        cardId: selectedCardId,
        action: "play_joker",
        mode: "damage_player",
        targetPlayerId,
      });
    } else {
      handleAction({
        cardId: selectedCardId,
        action: activePlayerAction.action,
        targetPlayerId,
      });
    }
    setSelectedCardId(null);
  };

  const handleDockChip = (action: ValidAction) => {
    if (!selectedCardId || action.disabled) return;
    if (action.targetType === "pick_abyss") {
      setAbyssPickerAction(action);
      return;
    }
    // Targeted chip (e.g. Diamond boost): arm it, then the player taps a
    // glowing board target to finish.
    if (action.requiresTarget && (action.targetType === "any_royal" || action.targetType === "any_player")) {
      buzzSelect();
      setArmedAction(action);
      return;
    }
    buzzAction();
    handleAction({ cardId: selectedCardId, action: action.action });
  };

  // ---- Attack selection machinery (unchanged logic, new visuals) ----
  const handleToggleAttackRoyal = (royalId: string) => {
    const royal = myState?.court.find((r) => r.cardId === royalId);
    if (!royal || royal.hasAttackedThisTurn || royal.hasteLocked) return;
    buzzSelect();
    setSelectedAttackRoyalIds((prev) => {
      const next = new Set(prev);
      if (next.has(royalId)) {
        next.delete(royalId);
        setTargetAssignments((prevAssign) => {
          if (!(royalId in prevAssign)) return prevAssign;
          const { [royalId]: _removed, ...rest } = prevAssign;
          return rest;
        });
        setActiveAssignRoyalId((prevActive) => (prevActive === royalId ? null : prevActive));
        if (next.size === 0) {
          setAssigningTargets(false);
        }
      } else {
        next.add(royalId);
      }
      return next;
    });
  };

  const handleConfirmAttackSelection = () => {
    if (selectedAttackRoyalIds.size === 0) return;
    const royalCardIds = Array.from(selectedAttackRoyalIds);
    const activeOpponents = opponents.filter((o) => !o.isEliminated);
    if (activeOpponents.length === 0) return;
    if (activeOpponents.length === 1) {
      handleAttack([{ targetPlayerId: activeOpponents[0]!.id, royalCardIds }]);
    } else {
      setAssigningTargets(true);
      setTargetAssignments({});
      setActiveAssignRoyalId(royalCardIds[0] ?? null);
      // Jump to the opponents — that's where you tap to assign.
      requestAnimationFrame(() => boardScrollRef.current?.scrollTo({ y: 0, animated: true }));
    }
  };

  const handleSelectRoyalForAssign = (royalId: string) => {
    if (!selectedAttackRoyalIds.has(royalId)) return;
    setActiveAssignRoyalId(royalId);
  };

  const handleCancelAssignTargets = () => {
    setAssigningTargets(false);
    setTargetAssignments({});
    setActiveAssignRoyalId(null);
  };

  const handleDeclareMultiAttack = () => {
    const royalCardIds = Array.from(selectedAttackRoyalIds);
    if (royalCardIds.some((id) => !targetAssignments[id])) return;
    const groups = new Map<string, string[]>();
    for (const royalId of royalCardIds) {
      const targetId = targetAssignments[royalId]!;
      const list = groups.get(targetId) ?? [];
      list.push(royalId);
      groups.set(targetId, list);
    }
    const targets = Array.from(groups.entries()).map(([targetPlayerId, ids]) => ({
      targetPlayerId,
      royalCardIds: ids,
    }));
    handleAttack(targets);
  };

  const handleAttackButtonPress = () => {
    setSelectedCardId(null);
    setAbyssPickerAction(null);
    setArmedAction(null);
    setAttackSelectMode(true);
    // With a single eligible attacker there's nothing to choose — pre-select
    // it so the player goes straight to confirming/targeting.
    setSelectedAttackRoyalIds(
      eligibleAttackers.length === 1 ? new Set([eligibleAttackers[0]!.cardId]) : new Set(),
    );
  };

  // ---- Board derived state ----
  const ineligibleRoyalIds = new Set(
    (myState?.court ?? [])
      .filter((r) => r.hasAttackedThisTurn || r.hasteLocked)
      .map((r) => r.cardId),
  );

  // Royals involved in the current duel, grouped by owner, so both seats can
  // badge exactly which cards are fighting.
  const duelRoyalIdsByPlayer: Record<string, Set<string>> = {};
  if (inDuel && duelCtx) {
    const atkSet = new Set<string>();
    const defSet = new Set<string>();
    for (const a of gameState?.attacks ?? []) {
      if (
        a.attackerPlayerId !== duelCtx.attackerPlayerId ||
        a.targetPlayerId !== duelCtx.defenderPlayerId ||
        !a.blockerCardIds ||
        a.blockerCardIds.length === 0
      ) {
        continue;
      }
      atkSet.add(a.attackerCardId);
      for (const b of a.blockerCardIds) defSet.add(b);
    }
    duelRoyalIdsByPlayer[duelCtx.attackerPlayerId] = atkSet;
    duelRoyalIdsByPlayer[duelCtx.defenderPlayerId] = defSet;
  }
  const myDuelingIds = duelRoyalIdsByPlayer[myId];

  const centerStageActive = showBlockPanel || showDuelStage || (inRespondToClub && !!pendingClub);

  // 4-player focus: the seat the game says matters wins; otherwise user pick.
  const activeOpponentsList = opponents.filter((o) => !o.isEliminated);
  const forcedFocusId =
    opponents.find((o) => waitingOn[o.id])?.id ??
    (inDeclareBlocks || inDuel || inAssignDamageOrder
      ? opponents.find((o) => attacksTargetingMe.some((a) => a.attackerPlayerId === o.id))?.id
      : undefined) ??
    (inDuel && duelCtx
      ? opponents.find((o) => o.id === duelCtx.attackerPlayerId || o.id === duelCtx.defenderPlayerId)?.id
      : undefined);
  const effectiveFocusId =
    forcedFocusId ??
    (focusedOpponentId && opponents.some((o) => o.id === focusedOpponentId && !o.isEliminated)
      ? focusedOpponentId
      : activeOpponentsList[0]?.id ?? opponents[0]?.id);

  const attacksFrom = (oppId: string) =>
    (inDeclareBlocks || inDuel || inAssignDamageOrder)
      ? attacksTargetingMe.filter((a) => a.attackerPlayerId === oppId).map((a) => a.attackerCardId)
      : undefined;

  const renderOpponentSeat = (opp: PublicPlayerState, opts: { compact?: boolean; courtSize?: "sm" | "md" | "lg" }) => {
    const oppRoyalGlow =
      targetingRoyals && !opp.isEliminated ? new Set(opp.court.map((r) => r.cardId)) : undefined;
    const crestTargetable =
      !opp.isEliminated &&
      (targetingPlayers || (assigningTargets && !!activeAssignRoyalId));
    return (
      <Seat
        key={opp.id}
        player={opp}
        displayName={displayNames[opp.id] ?? opp.id.slice(0, 8)}
        color={colorOf(opp.id)}
        isTurnHolder={!!waitingOn[opp.id]}
        statusChip={waitingOn[opp.id] ?? null}
        isEliminated={opp.isEliminated}
        compact={opts.compact}
        onFocusPress={opts.compact ? () => setFocusedOpponentId(opp.id) : undefined}
        courtSize={opts.courtSize ?? "sm"}
        onRoyalPress={
          targetingRoyals && !opp.isEliminated
            ? (royalId) => dispatchRoyalTarget(opp.id, royalId)
            : undefined
        }
        royalGlowIds={oppRoyalGlow}
        glowColor={colorOf(myId)}
        highlightedIds={duelRoyalIdsByPlayer[opp.id]}
        highlightBadgeText={duelRoyalIdsByPlayer[opp.id]?.size ? "⚔ DUEL" : undefined}
        crestTargetable={crestTargetable}
        crestTargetHint={assigningTargets ? "⚔ SEND HERE" : "🎯 TAP"}
        onCrestPress={() => dispatchPlayerTarget(opp.id)}
        attackingYouWith={attacksFrom(opp.id)}
        hitEffects={seatEffects[opp.id]}
        royalHitEffects={royalEffects}
        onHandPress={
          gameState.revealedHands?.[opp.id]
            ? () => setRevealedHandPlayerId(opp.id)
            : undefined
        }
      />
    );
  };

  const myCourtSize: "md" | "lg" = opponents.length <= 1 && !centerStageActive ? "lg" : "md";

  const myRoyalGlow =
    targetingRoyals && myState ? new Set(myState.court.map((r) => r.cardId)) : undefined;

  const phaseLabel = attackSelectMode
    ? "Choosing attackers"
    : PHASE_LABELS[phase] ?? phase.replace(/_/g, " ");

  const headerLine = isMyTurn
    ? `Turn ${gameState.turnNumber} — Your turn`
    : `Turn ${gameState.turnNumber} — ${activePlayerName}'s turn`;

  return (
    <View style={styles.container}>
      <SanctumBackground runeCenter={0.42} />

      {/* ---- Status strip (single line, safe-area aware) ---- */}
      <View style={[styles.header, { paddingTop: topInset + 6 }]}>
        <Pressable
          onPress={() => setShowMenu((m) => !m)}
          hitSlop={8}
          style={({ pressed }) => [styles.menuBtn, pressed && { opacity: 0.6 }]}
        >
          <Ionicons name="ellipsis-horizontal-circle" size={24} color={Colors.textSecondary} />
        </Pressable>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            <Text style={{ color: colorOf(gameState.activePlayerId) }}>{headerLine}</Text>
            <Text style={styles.headerPhase}>  ·  {phaseLabel}</Text>
          </Text>
        </View>
        <View style={styles.menuBtn} />
      </View>

      {showMenu && (
        <View style={[styles.menuDropdown, { top: topInset + 40 }]}>
          <Pressable
            onPress={() => {
              setSfxMuted(!sfxMuted);
              setSfxMutedState(!sfxMuted);
            }}
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
          >
            <Ionicons
              name={sfxMuted ? "volume-mute" : "volume-high"}
              size={16}
              color={Colors.textSecondary}
            />
            <Text style={styles.menuItemLabel}>{sfxMuted ? "Sound: Off" : "Sound: On"}</Text>
          </Pressable>
          <Pressable
            onPress={handleAbandon}
            style={({ pressed }) => [styles.menuItem, pressed && { opacity: 0.7 }]}
          >
            <Ionicons name="flag" size={16} color={Colors.accentRed} />
            <Text style={styles.menuItemDanger}>End game for everyone</Text>
          </Pressable>
        </View>
      )}

      {/* ---- The table. Fits the screen as a fixed layout; if a busy turn
           (block panel + full courts) overflows, it becomes scrollable so
           regions never overlap or hide each other. ---- */}
      <ScrollView
        ref={boardScrollRef}
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Attack-target assignment lives WITH the opponents (top) so you tap
            a Royal chip here, then tap an opponent seat right below it. */}
        {assigningTargets && (
          <Animated.View entering={FadeInDown.duration(180)} style={styles.assignBanner}>
            <View style={styles.assignBannerHead}>
              <Ionicons name="flash" size={14} color={Colors.accentRed} />
              <Text style={styles.assignBannerText}>
                {activeAssignRoyalId
                  ? (() => {
                      const r = myState?.court.find((x) => x.cardId === activeAssignRoyalId);
                      const c = parseCardId(activeAssignRoyalId);
                      return `Tap an opponent below to send ${c.displayRank}${c.suitSymbol} (⚔${effectiveAttack(activeAssignRoyalId, r?.buffAttack ?? 0)} ♥${effectiveHealth(activeAssignRoyalId, r?.buffHealth ?? 0, r?.damageTaken ?? 0)})`;
                    })()
                  : "Every Royal has a target — declare below"}
              </Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignChipRow}>
              {Array.from(selectedAttackRoyalIds).map((royalId) => {
                const card = parseCardId(royalId);
                const royal = myState?.court.find((r) => r.cardId === royalId);
                const atkV = effectiveAttack(royalId, royal?.buffAttack ?? 0);
                const hpV = effectiveHealth(royalId, royal?.buffHealth ?? 0, royal?.damageTaken ?? 0);
                const assignedTo = targetAssignments[royalId];
                const isActive = activeAssignRoyalId === royalId;
                return (
                  <Pressable
                    key={royalId}
                    onPress={() => handleSelectRoyalForAssign(royalId)}
                    style={({ pressed }) => [
                      styles.assignChip,
                      isActive && styles.assignChipActive,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <Text style={[styles.assignChipCard, { color: card.suitColor }]}>
                      {card.displayRank}{card.suitSymbol}{" "}
                      <Text style={styles.assignChipAtk}>⚔{atkV}</Text>{" "}
                      <Text style={styles.assignChipHp}>♥{hpV}</Text>
                    </Text>
                    <Text style={styles.assignChipTarget} numberOfLines={1}>
                      {assignedTo ? `→ ${nameFor(assignedTo)}` : "no target"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          </Animated.View>
        )}

        {/* Opponent region — redistributes per player count. */}
        {opponents.length === 1 && (
          <View style={styles.oppRegion}>
            {renderOpponentSeat(opponents[0]!, {
              courtSize: centerStageActive ? "sm" : "md",
            })}
          </View>
        )}
        {opponents.length === 2 && (
          <View style={[styles.oppRegion, styles.oppRow]}>
            {opponents.map((opp) => (
              <View key={opp.id} style={styles.oppFlex}>
                {renderOpponentSeat(opp, { courtSize: "sm" })}
              </View>
            ))}
          </View>
        )}
        {opponents.length >= 3 && (
          <View style={styles.oppRegion}>
            {centerStageActive && !targetingRoyals ? (
              <View style={styles.oppRow}>
                {opponents.map((opp) => renderOpponentSeat(opp, { compact: true }))}
              </View>
            ) : (
              <>
                {opponents
                  .filter((o) => o.id === effectiveFocusId)
                  .map((opp) => renderOpponentSeat(opp, { courtSize: "sm" }))}
                <View style={styles.oppRow}>
                  {opponents
                    .filter((o) => o.id !== effectiveFocusId)
                    .map((opp) => renderOpponentSeat(opp, { compact: true }))}
                </View>
              </>
            )}
          </View>
        )}

        {/* Center region: shared table, or the current confrontation. */}
        <View style={styles.centerRegion}>
          {/* How the last duel ended — informational, auto-clears, never blocks. */}
          {duelNotice && !showDuelStage && (
            <Animated.View entering={FadeInDown.duration(250)} style={styles.duelResultPanel}>
              <View style={styles.duelResultHeader}>
                <Ionicons name="flash" size={13} color="#C89B3C" />
                <Text style={styles.duelResultTitle}>{duelNotice.header ?? "Duel resolved"}</Text>
                <Pressable onPress={() => setDuelNotice(null)} hitSlop={8}>
                  <Ionicons name="close" size={16} color={Colors.textMuted} />
                </Pressable>
              </View>
              <Text style={styles.duelResultSub}>{duelNotice.title}</Text>
              {duelNotice.lines.map((line, i) => (
                <View key={`${i}-${line}`} style={styles.duelResultLineRow}>
                  <RichLine text={line} textStyle={styles.duelResultLine} />
                </View>
              ))}
            </Animated.View>
          )}
          {showBlockPanel && attacksTargetingMe[0] ? (
            <BlockPanel
              attacks={gameState.attacks}
              myId={myId}
              myCourt={myState?.court ?? []}
              attackerCourt={gameState.players[attacksTargetingMe[0].attackerPlayerId]?.court ?? []}
              attackerName={nameFor(attacksTargetingMe[0].attackerPlayerId)}
              attackerColor={colorOf(attacksTargetingMe[0].attackerPlayerId)}
              isSubmitting={isSubmitting}
              onConfirm={handleConfirmBlocks}
              attachTargeting={
                targetingRoyals &&
                activeRoyalAction &&
                (activeRoyalAction.action === "attach_spade" || activeRoyalAction.action === "attach_heart")
                  ? {
                      hint:
                        targetHintFor(activeRoyalAction, selectedCard?.pipValue ?? 0) ??
                        "Tap a Royal to attach",
                      onAttach: (royalId) => dispatchRoyalTarget(myId, royalId),
                    }
                  : undefined
              }
              attackerTargeting={
                targetingRoyals &&
                !gameState.players[attacksTargetingMe[0].attackerPlayerId]?.isEliminated
                  ? {
                      onTarget: (royalId) =>
                        dispatchRoyalTarget(attacksTargetingMe[0]!.attackerPlayerId, royalId),
                    }
                  : undefined
              }
            />
          ) : showDuelStage && duelCtx ? (
            <DuelStage
              phase={phase}
              attacks={gameState.attacks.filter(
                (a) =>
                  a.blockerCardIds &&
                  a.blockerCardIds.length > 0 &&
                  a.attackerPlayerId === duelCtx.attackerPlayerId &&
                  a.targetPlayerId === duelCtx.defenderPlayerId,
              )}
              duelContext={duelCtx}
              myId={myId}
              attackerCourt={gameState.players[duelCtx.attackerPlayerId]?.court ?? []}
              defenderCourt={gameState.players[duelCtx.defenderPlayerId]?.court ?? []}
              displayNames={displayNames}
              attackerColor={colorOf(duelCtx.attackerPlayerId)}
              defenderColor={colorOf(duelCtx.defenderPlayerId)}
              isSubmitting={isSubmitting}
              targetingRoyals={targetingRoyals}
              targetGlowColor={colorOf(myId)}
              onRoyalTarget={dispatchRoyalTarget}
              completedDuels={completedDuels}
              upcomingDuels={(gameState.duelQueue ?? []).map((qid) => ({
                name: nameFor(qid),
                color: colorOf(qid),
                fights: gameState.attacks.filter(
                  (a) =>
                    a.attackerPlayerId === duelCtx.attackerPlayerId &&
                    a.targetPlayerId === qid &&
                    (a.blockerCardIds?.length ?? 0) > 0,
                ).length,
              }))}
              onPass={handleDuelPass}
            />
          ) : inRespondToClub && pendingClub ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.clubPanel}>
              <View style={styles.clubPanelHeader}>
                <Ionicons name="warning" size={16} color="#C89B3C" />
                <Text style={styles.clubPanelTitle}>
                  {isClubResponder
                    ? `${clubAttackerName === "You" ? "You're" : `${clubAttackerName} is`} playing a Club on your Royal!`
                    : `${possFor(pendingClub.attackerPlayerId)} Club → ${possFor(pendingClub.targetPlayerId)} Royal`}
                </Text>
              </View>
              <View style={styles.clubPanelBody}>
                <View style={styles.clubCardPreview}>
                  <Text style={styles.clubPanelLabel}>Club</Text>
                  <CardView cardId={pendingClub.clubCardId} size="sm" />
                </View>
                <Ionicons name="arrow-forward" size={18} color={Colors.textMuted} />
                <View style={styles.clubCardPreview}>
                  <Text style={styles.clubPanelLabel}>Target</Text>
                  {isClubResponder && targetingRoyals ? (
                    <Pressable
                      onPress={() => dispatchRoyalTarget(pendingClub.targetPlayerId, pendingClub.targetRoyalId)}
                      style={({ pressed }) => [styles.clubTargetRing, pressed && { opacity: 0.7 }]}
                    >
                      <CardView cardId={pendingClub.targetRoyalId} size="sm" glowColor={colorOf(myId)} />
                      <View style={styles.clubTargetBadge}>
                        <Text style={styles.clubTargetBadgeText}>🎯</Text>
                      </View>
                    </Pressable>
                  ) : (
                    <CardView cardId={pendingClub.targetRoyalId} size="sm" />
                  )}
                  {targetedClubRoyal && (
                    <Text style={styles.clubRoyalStats}>
                      ⚔{effectiveAttack(targetedClubRoyal.cardId, targetedClubRoyal.buffAttack)}{"  "}
                      ♥{effectiveHealth(targetedClubRoyal.cardId, targetedClubRoyal.buffHealth, targetedClubRoyal.damageTaken)}
                    </Text>
                  )}
                </View>
                <View style={styles.clubPanelRight}>
                  {isClubResponder ? (
                    <>
                      <Text style={styles.clubPanelHint}>
                        {targetingRoyals
                          ? "Tap your Royal to apply the spell, or accept the Club."
                          : "Strengthen your Royal with Hearts, Spades, Clubs or a Joker — or accept it."}
                      </Text>
                      <Pressable
                        onPress={handleConfirmClubResponse}
                        disabled={isSubmitting}
                        style={({ pressed }) => [styles.clubConfirmBtn, pressed && { opacity: 0.8 }]}
                      >
                        {isSubmitting ? (
                          <ActivityIndicator size="small" color={Colors.bgDeep} />
                        ) : (
                          <Text style={styles.clubConfirmText}>Accept the Club</Text>
                        )}
                      </Pressable>
                    </>
                  ) : (
                    <View style={styles.waitingInline}>
                      <ActivityIndicator size="small" color={Colors.textMuted} />
                      <Text style={styles.waitingText}>Waiting for {clubDefenderName}…</Text>
                    </View>
                  )}
                </View>
              </View>
            </Animated.View>
          ) : (
            <TableCenter
              mine={gameState.mine ?? []}
              abyss={gameState.abyss}
              deckCount={gameState.deck}
            />
          )}

          <EventTicker events={events} />

          {/* Compact waiting strips (never push the layout around). */}
          {!isMyTurn && !inDeclareBlocks && !inRespondToClub && !inDuel && !inAssignDamageOrder && !inInterrupt && (
            <View style={styles.waitingInlineCentered}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Text style={styles.waitingText}>
                {gameState.activePlayerId === botPlayerId
                  ? `${activePlayerName} is thinking…`
                  : `Waiting for ${activePlayerName}…`}
              </Text>
            </View>
          )}
          {!isMyTurn && inDeclareBlocks && attacksTargetingMe.length === 0 && (
            <View style={styles.waitingInlineCentered}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Text style={styles.waitingText}>
                {pendingBlockDefenders?.length
                  ? `${pendingBlockDefenders.map((id) => nameFor(id)).join(", ")} choosing blocks…`
                  : "Blocks being chosen…"}
              </Text>
            </View>
          )}
          {waitingOnOtherDefenders && (
            <View style={styles.waitingInlineCentered}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Text style={styles.waitingText}>
                Blocks sent — waiting for {(pendingBlockDefenders ?? []).map((id) => nameFor(id)).join(", ")}…
              </Text>
            </View>
          )}
          {inAssignDamageOrder && duelCtx && myId !== duelCtx.attackerPlayerId && (
            <View style={styles.waitingInlineCentered}>
              <ActivityIndicator size="small" color={Colors.textMuted} />
              <Text style={styles.waitingText}>Attacker is ordering damage…</Text>
            </View>
          )}
        </View>

        {/* My seat — stats anchored to my court. */}
        {myState && (
          <View style={styles.myRegion}>
            <Seat
              player={myState}
              displayName={user?.displayName ?? "You"}
              color={colorOf(myId)}
              isMe
              isTurnHolder={!!waitingOn[myId]}
              statusChip={waitingOn[myId] ?? null}
              isEliminated={amIEliminated}
              courtSize={myCourtSize}
              phase={phase}
              isDefender={isDefender}
              onRoyalPress={
                attackSelectMode && !assigningTargets
                  ? handleToggleAttackRoyal
                  : assigningTargets
                    ? handleSelectRoyalForAssign
                    : targetingRoyals
                      ? (royalId) => dispatchRoyalTarget(myId, royalId)
                      : undefined
              }
              royalGlowIds={attackSelectMode || assigningTargets ? undefined : myRoyalGlow}
              glowColor={colorOf(myId)}
              selectedTargetId={assigningTargets ? activeAssignRoyalId : null}
              highlightedIds={
                attackSelectMode || assigningTargets
                  ? selectedAttackRoyalIds
                  : myDuelingIds && myDuelingIds.size > 0
                    ? myDuelingIds
                    : undefined
              }
              highlightBadgeText={
                !attackSelectMode && myDuelingIds && myDuelingIds.size > 0 ? "⚔ DUEL" : undefined
              }
              dimmedIds={attackSelectMode && !assigningTargets ? ineligibleRoyalIds : undefined}
              crestTargetable={targetingPlayers && !assigningTargets}
              crestTargetHint="🎯 TAP"
              onCrestPress={() => dispatchPlayerTarget(myId)}
              hitEffects={seatEffects[myId]}
              royalHitEffects={royalEffects}
            />
          </View>
        )}
      </ScrollView>

      {/* ---- Mode strips & action bar (pinned above the hand) ---- */}
      {attackSelectMode && !assigningTargets && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.modeStrip}>
          <Ionicons name="flash" size={14} color={Colors.accentRed} />
          <Text style={styles.modeStripText}>
            {eligibleAttackers.length === 1
              ? "Your Royal is ready — confirm the attack below"
              : `Tap your Royals to pick attackers${selectedAttackRoyalIds.size > 0 ? ` — ${selectedAttackRoyalIds.size} chosen` : ""}`}
          </Text>
        </Animated.View>
      )}

      {inDiscardPhase && (
        <Animated.View entering={FadeInDown.duration(180)} style={[styles.modeStrip, styles.modeStripGold]}>
          <Ionicons name="trash" size={14} color="#C89B3C" />
          <Text style={[styles.modeStripText, { color: "#C89B3C" }]}>
            Hand limit is 7 — tap {discardCount} card{discardCount !== 1 ? "s" : ""} to discard
          </Text>
        </Animated.View>
      )}

      {/* Action bar */}
      {!gameOverReveal && (showAttackButton || canEndTurn || attackSelectMode || assigningTargets) && (
        <View style={styles.actionBar}>
          {attackSelectMode && !assigningTargets ? (
            <>
              <Pressable
                onPress={() => {
                  setAttackSelectMode(false);
                  setSelectedAttackRoyalIds(new Set());
                }}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleConfirmAttackSelection}
                disabled={selectedAttackRoyalIds.size === 0 || isSubmitting}
                style={({ pressed }) => [
                  styles.primaryBtn,
                  styles.attackBtn,
                  (selectedAttackRoyalIds.size === 0 || isSubmitting) && styles.primaryBtnDisabled,
                  pressed && selectedAttackRoyalIds.size > 0 && { opacity: 0.85 },
                ]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={16} color={selectedAttackRoyalIds.size > 0 ? "#FFF" : Colors.textMuted} />
                    <Text style={[styles.primaryBtnText, styles.attackBtnText, selectedAttackRoyalIds.size === 0 && { color: Colors.textMuted }]}>
                      {selectedAttackRoyalIds.size > 0
                        ? `Attack with ${selectedAttackRoyalIds.size} →`
                        : "Pick a Royal"}
                    </Text>
                  </>
                )}
              </Pressable>
            </>
          ) : assigningTargets ? (
            (() => {
              const allAssigned = Array.from(selectedAttackRoyalIds).every((id) => !!targetAssignments[id]);
              return (
                <>
                  <Pressable
                    onPress={handleCancelAssignTargets}
                    style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.8 }]}
                  >
                    <Text style={styles.cancelBtnText}>Back</Text>
                  </Pressable>
                  <Pressable
                    onPress={handleDeclareMultiAttack}
                    disabled={!allAssigned || isSubmitting}
                    style={({ pressed }) => [
                      styles.primaryBtn,
                      styles.attackBtn,
                      (!allAssigned || isSubmitting) && styles.primaryBtnDisabled,
                      pressed && allAssigned && { opacity: 0.85 },
                    ]}
                  >
                    {isSubmitting ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <Text style={[styles.primaryBtnText, styles.attackBtnText, !allAssigned && { color: Colors.textMuted }]}>
                        {allAssigned ? "⚔ Declare attack" : "Assign every Royal"}
                      </Text>
                    )}
                  </Pressable>
                </>
              );
            })()
          ) : (
            <>
              {showAttackButton && (
                <Pressable
                  onPress={handleAttackButtonPress}
                  disabled={isSubmitting}
                  style={({ pressed }) => [styles.primaryBtn, styles.attackBtn, pressed && { opacity: 0.85 }]}
                >
                  <Ionicons name="flash" size={16} color="#FFF" />
                  <Text style={[styles.primaryBtnText, styles.attackBtnText]}>Attack</Text>
                </Pressable>
              )}
              {canEndTurn && (
                <Pressable
                  onPress={handleEndTurn}
                  disabled={isSubmitting}
                  style={({ pressed }) => [styles.primaryBtn, pressed && { opacity: 0.85 }]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.bgDeep} />
                  ) : (
                    <>
                      <Text style={styles.primaryBtnText}>End turn</Text>
                      <Ionicons name="arrow-forward" size={16} color={Colors.bgDeep} />
                    </>
                  )}
                </Pressable>
              )}
            </>
          )}
        </View>
      )}

      {/* Selected-card dock / abyss picker */}
      {gameOverReveal ? null : selectedCardId && abyssPickerAction ? (
        <AbyssPicker
          abyss={gameState.abyss}
          maxValue={selectedCard?.pipValue ?? 0}
          onPick={(targetCardId) => {
            handleAction({ cardId: selectedCardId, action: abyssPickerAction.action, targetCardId });
          }}
          onClose={() => setAbyssPickerAction(null)}
        />
      ) : selectedCardId && !attackSelectMode && !inDiscardPhase ? (
        <ActionDock
          cardId={selectedCardId}
          chipActions={dockChipActions}
          targetHints={dockTargetHints}
          blockedReason={selectedCardBlockedReason}
          onChipPress={handleDockChip}
          onClose={() => {
            // When a targeted chip is armed, closing backs out of targeting
            // (shows the chips again) rather than dropping the card entirely.
            if (armedAction) {
              setArmedAction(null);
              return;
            }
            setSelectedCardId(null);
            setAbyssPickerAction(null);
          }}
        />
      ) : null}

      {!gameOverReveal && (
      <HandTray
        cards={gameState.myHand}
        selectedCardId={selectedCardId}
        isMyTurn={isMyTurn}
        isDefender={isDefender}
        isClubResponder={isClubResponder}
        isMyDuelTurn={!!isMyDuelTurn}
        isMyInterruptTurn={!!isMyInterruptTurn}
        canInitiateInterrupt={canInitiateInterrupt}
        phase={phase}
        vault={vault}
        accentColor={colorOf(myId)}
        canPlayCard={canPlayHandCard}
        onCardPress={handleCardPress}
      />
      )}

      <View style={{ height: bottomInset }} />

      {showDamageOrderModal && duelCtx && (
        <DamageOrderModal
          visible={showDamageOrderModal}
          attacks={gameState.attacks}
          attackerCourt={gameState.players[duelCtx.attackerPlayerId]?.court ?? []}
          defenderCourt={gameState.players[duelCtx.defenderPlayerId]?.court ?? []}
          isSubmitting={isSubmitting}
          onConfirm={handleSetDamageOrder}
        />
      )}

      {/* Debug/testing: revealed hand viewer for AI seats. */}
      {revealedHandPlayerId && gameState?.revealedHands?.[revealedHandPlayerId] && (
        <Pressable style={styles.revealOverlay} onPress={() => setRevealedHandPlayerId(null)}>
          <View style={styles.revealPanel}>
            <View style={styles.revealHeader}>
              <Text style={styles.revealTitle}>
                {displayNames[revealedHandPlayerId] ?? revealedHandPlayerId.slice(0, 8)}'s hand (debug)
              </Text>
              <Pressable onPress={() => setRevealedHandPlayerId(null)} hitSlop={8}>
                <Ionicons name="close" size={18} color={Colors.textMuted} />
              </Pressable>
            </View>
            <View style={styles.revealCards}>
              {gameState.revealedHands[revealedHandPlayerId]!.map((cardId) => (
                <CardView key={cardId} cardId={cardId} size="sm" />
              ))}
            </View>
          </View>
        </Pressable>
      )}

      {/* Cinematic overlays — decorative only, never intercept touches. */}
      <CardFlightHost flights={flights} />
      {turnFlare && <TurnFlare key={`flare-${turnFlare.key}`} color={turnFlare.color} />}
      {yourTurnKey !== null && <YourTurnBanner key={`yourturn-${yourTurnKey}`} color={colorOf(myId)} />}

      {/* Winner banner: docked at the top with NO backdrop, so the final
          board and ticker stay fully interactive for reviewing what
          happened. The only way forward is the explicit View Results button
          (or a rematch signal) — no auto-advance. */}
      {gameOverReveal && (() => {
        const didWin = gameOverReveal.winnerUserId === myId;
        const winnerName = gameOverReveal.winnerUserId
          ? nameFor(gameOverReveal.winnerUserId)
          : null;
        const accent = didWin ? Colors.brand : Colors.accentRed;
        return (
          <Animated.View
            entering={FadeInDown.duration(400)}
            style={[styles.gameOverBanner, { top: topInset + 8, borderColor: accent }]}
            testID="game-over-reveal"
          >
            <Ionicons name={didWin ? "trophy" : "skull"} size={22} color={accent} />
            <View style={styles.gameOverBannerTextCol}>
              <Text style={[styles.gameOverBannerTitle, { color: accent }]} numberOfLines={1}>
                {didWin ? "You win!" : winnerName ? `${winnerName} wins!` : "Match over"}
              </Text>
              <Text style={styles.gameOverBannerHint}>Review the board, then continue</Text>
            </View>
            <Pressable
              onPress={() => navigateToGameOver(gameOverReveal.winnerUserId)}
              style={({ pressed }) => [styles.gameOverResultsBtn, pressed && { opacity: 0.8 }]}
              testID="view-results-button"
            >
              <Text style={styles.gameOverResultsBtnText}>View Results</Text>
              <Ionicons name="arrow-forward" size={14} color="#0A0A0F" />
            </Pressable>
          </Animated.View>
        );
      })()}

      {/* Elimination announcement — prominent, explains the court sweep, and
          stacks ABOVE the winner banner so the "why" lands before the "who
          won". Dismissible via OK; auto-clears after ~10s. */}
      {elimNotice && (() => {
        const isMe = elimNotice.playerId === myId;
        const name = nameFor(elimNotice.playerId);
        return (
          <View style={styles.elimOverlay} pointerEvents="box-none">
            <Animated.View entering={FadeInDown.duration(300)} style={styles.elimPanel} testID="elimination-notice">
              <Ionicons name="skull" size={30} color={Colors.accentRed} />
              <Text style={styles.elimTitle}>
                {isMe ? "You have been eliminated!" : `${name} has been eliminated!`}
              </Text>
              <Text style={styles.elimBody}>
                {isMe ? "Your" : `${name}'s`} life reached 0
                {elimNotice.sweptCount > 0
                  ? ` — all ${elimNotice.sweptCount} of ${isMe ? "your" : "their"} court card${elimNotice.sweptCount !== 1 ? "s were" : " was"} swept to the Abyss.`
                  : `.${isMe ? " You're spectating now." : ""}`}
              </Text>
              <Pressable
                onPress={() => setElimNotice(null)}
                style={({ pressed }) => [styles.elimBtn, pressed && { opacity: 0.8 }]}
                testID="elimination-notice-dismiss"
              >
                <Text style={styles.elimBtnText}>OK</Text>
              </Pressable>
            </Animated.View>
          </View>
        );
      })()}

      <ToastHost toasts={toasts} />
    </View>
  );
}

const styles = StyleSheet.create({
  revealOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 40,
    padding: 24,
  },
  revealPanel: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: 16,
    gap: 12,
    maxWidth: 420,
    width: "100%",
  },
  revealHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  revealTitle: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  revealCards: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  elimOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 70,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  elimPanel: {
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: Colors.accentRed,
    paddingVertical: 18,
    paddingHorizontal: 22,
    maxWidth: 340,
    shadowColor: "#000",
    shadowOpacity: 0.5,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 10,
  },
  elimTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: Colors.accentRed,
    textAlign: "center",
  },
  elimBody: {
    fontSize: 13,
    color: Colors.textPrimary,
    textAlign: "center",
    lineHeight: 19,
  },
  elimBtn: {
    marginTop: 4,
    backgroundColor: Colors.accentRed,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 28,
  },
  elimBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#FFF",
  },
  gameOverBanner: {
    position: "absolute",
    left: 12,
    right: 12,
    zIndex: 60,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 1.5,
    paddingVertical: 10,
    paddingHorizontal: 14,
    // Float above the board without a full backdrop.
    shadowColor: "#000",
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  gameOverBannerTextCol: {
    flex: 1,
    gap: 1,
  },
  gameOverBannerTitle: {
    fontSize: 18,
    fontFamily: "Cinzel_700Bold",
    letterSpacing: 0.5,
  },
  gameOverBannerHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  gameOverResultsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  gameOverResultsBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#0A0A0F",
  },
  container: {
    flex: 1,
    backgroundColor: Colors.bgDeep,
  },
  centered: {
    alignItems: "center",
    justifyContent: "center",
    gap: 16,
  },
  loadingText: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    marginTop: 12,
  },
  errorText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  backBtn: {
    marginTop: 16,
    paddingVertical: 10,
    paddingHorizontal: 24,
    backgroundColor: Colors.bgSurface,
    borderRadius: 12,
  },
  backBtnText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
    zIndex: 20,
    backgroundColor: "rgba(10,31,19,0.9)",
  },
  menuBtn: {
    width: 32,
    alignItems: "center",
  },
  headerCenter: {
    flex: 1,
    alignItems: "center",
  },
  headerTitle: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  headerPhase: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  menuDropdown: {
    position: "absolute",
    left: 10,
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    paddingVertical: 4,
    zIndex: 30,
    elevation: 10,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  menuItemDanger: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
  },
  menuItemLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  board: {
    flex: 1,
  },
  boardContent: {
    flexGrow: 1,
    paddingVertical: 6,
    gap: 6,
  },
  oppRegion: {
    paddingHorizontal: 8,
    gap: 6,
  },
  oppRow: {
    flexDirection: "row",
    gap: 6,
    alignItems: "stretch",
  },
  oppFlex: {
    flex: 1,
  },
  centerRegion: {
    flexGrow: 1,
    justifyContent: "center",
    gap: 4,
  },
  myRegion: {
    paddingHorizontal: 8,
  },
  duelResultPanel: {
    marginHorizontal: 8,
    backgroundColor: "rgba(200,155,60,0.10)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: "#C89B3C",
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 3,
  },
  duelResultHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  duelResultTitle: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    letterSpacing: 0.5,
  },
  duelResultSub: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  duelResultLineRow: {
    flexDirection: "row",
    paddingLeft: 10,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(200,155,60,0.4)",
    marginLeft: 2,
  },
  duelResultLine: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: Colors.textPrimary,
  },
  clubPanel: {
    marginHorizontal: 8,
    backgroundColor: "rgba(200,155,60,0.1)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#C89B3C",
    padding: 10,
    gap: 8,
  },
  clubPanelHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  clubPanelTitle: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  clubPanelBody: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  clubCardPreview: {
    alignItems: "center",
    gap: 3,
  },
  clubPanelLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  clubRoyalStats: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  clubTargetRing: {
    borderWidth: 2,
    borderColor: "#C89B3C",
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 2,
  },
  clubTargetBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    backgroundColor: "#C89B3C",
    borderRadius: 9,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  clubTargetBadgeText: {
    fontSize: 10,
  },
  clubPanelRight: {
    flex: 1,
    gap: 8,
  },
  clubPanelHint: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  clubConfirmBtn: {
    backgroundColor: "#C89B3C",
    borderRadius: 10,
    paddingVertical: 8,
    alignItems: "center",
  },
  clubConfirmText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  waitingInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  waitingInlineCentered: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 2,
  },
  waitingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  modeStrip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200,16,46,0.12)",
    borderTopWidth: 1,
    borderTopColor: "rgba(229,57,53,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  modeStripGold: {
    backgroundColor: "rgba(200,155,60,0.12)",
    borderTopColor: "#C89B3C",
  },
  modeStripColumn: {
    backgroundColor: "rgba(200,16,46,0.12)",
    borderTopWidth: 1,
    borderTopColor: "rgba(229,57,53,0.5)",
    paddingHorizontal: 14,
    paddingVertical: 7,
    gap: 6,
  },
  modeStripRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  modeStripText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  assignBanner: {
    marginHorizontal: 8,
    backgroundColor: "rgba(200,16,46,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(229,57,53,0.55)",
    borderRadius: 12,
    padding: 8,
    gap: 6,
  },
  assignBannerHead: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  assignBannerText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  assignChipAtk: {
    color: Colors.accentRed,
  },
  assignChipHp: {
    color: "#66BB6A",
  },
  assignChipRow: {
    gap: 6,
  },
  assignChip: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 9,
    borderWidth: 1.5,
    borderColor: Colors.border,
    paddingHorizontal: 9,
    paddingVertical: 5,
    alignItems: "center",
    gap: 1,
  },
  assignChipActive: {
    borderColor: Colors.accentRed,
    backgroundColor: "rgba(200,16,46,0.15)",
  },
  assignChipCard: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  assignChipTarget: {
    fontSize: 9,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    maxWidth: 84,
  },
  actionBar: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "rgba(10,31,19,0.9)",
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  cancelBtn: {
    paddingHorizontal: 16,
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
  },
  cancelBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: Colors.brand,
    borderRadius: 12,
    paddingVertical: 12,
  },
  primaryBtnDisabled: {
    backgroundColor: Colors.bgSurface,
  },
  primaryBtnText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  attackBtn: {
    backgroundColor: "#A81624",
  },
  attackBtnText: {
    color: "#FFF",
  },
});
