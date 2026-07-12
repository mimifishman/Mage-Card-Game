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
import { useAuth } from "@/lib/auth";
import Colors, { seatColorFor } from "@/constants/colors";
import HandTray from "@/components/game/HandTray";
import Seat from "@/components/game/Seat";
import TableCenter from "@/components/game/TableCenter";
import EventTicker from "@/components/game/EventTicker";
import type { GameEvent } from "@/components/game/EventTicker";
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

export interface ActionParams {
  cardId: string;
  action: string;
  targetRoyalId?: string;
  targetPlayerId?: string;
  targetCardId?: string;
  mode?: string;
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
  const router = useRouter();
  const insets = useSafeAreaInsets();
  // Web preview renders inside a simulated phone frame that doesn't expose
  // real safe-area insets — keep its tested constants.
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [gameState, setGameState] = useState<PlayerGameView | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [autoPassMessage, setAutoPassMessage] = useState<string | null>(null);

  const [attackSelectMode, setAttackSelectMode] = useState(false);
  const [selectedAttackRoyalIds, setSelectedAttackRoyalIds] = useState<Set<string>>(new Set());
  const [assigningTargets, setAssigningTargets] = useState(false);
  const [targetAssignments, setTargetAssignments] = useState<Record<string, string>>({});
  const [activeAssignRoyalId, setActiveAssignRoyalId] = useState<string | null>(null);

  // 4-player board: which opponent seat is expanded ("in focus").
  const [focusedOpponentId, setFocusedOpponentId] = useState<string | null>(null);
  const [abyssPickerAction, setAbyssPickerAction] = useState<ValidAction | null>(null);
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

  const pushEvent = useCallback((color: string, text: string) => {
    const id = idCounterRef.current++;
    setEvents((prev) => [...prev.slice(-60), { id, color, text }]);
  }, []);

  const prevPhaseRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<Record<string, { life: number; courtSize: number; eliminated: boolean }>>({});
  const prevActivePlayerRef = useRef<string | null>(null);
  const prevPendingClubRef = useRef<string | null>(null);
  const lastDuelCtxRef = useRef<import("@workspace/api-client-react").DuelContext | null>(null);
  const lastDuelAttacksRef = useRef<import("@workspace/api-client-react").AttackDeclaration[]>([]);
  const pendingCombatDamageRef = useRef<string[]>([]);
  const hasNavigatedRef = useRef(false);

  const { data: stateData, isLoading } = useGetMatchState(matchId ?? "", {
    query: {
      queryKey: getGetMatchStateQueryKey(matchId ?? ""),
      enabled: !!matchId,
      refetchInterval: 2000,
    },
  });

  const { data: matchData } = useGetMatch(matchId ?? "", {
    query: {
      queryKey: getGetMatchQueryKey(matchId ?? ""),
      enabled: !!matchId,
      refetchInterval: 2000,
    },
  });

  useEffect(() => {
    if (stateData?.state) {
      setGameState(stateData.state);
    }
  }, [stateData]);

  useEffect(() => {
    if (matchData?.players) {
      const names: Record<string, string> = {};
      for (const p of matchData.players) {
        names[p.userId] = p.displayName;
      }
      setDisplayNames(names);
    }
  }, [matchData]);

  useEffect(() => {
    if (hasNavigatedRef.current) return;
    if (matchData?.match?.status === "finished" && matchId) {
      hasNavigatedRef.current = true;
      router.replace({
        pathname: "/(game)/game-over",
        params: { matchId, winnerUserId: matchData.match.winnerUserId ?? "" },
      });
    }
  }, [matchData?.match?.status, matchData?.match?.winnerUserId, matchId]);

  // Track the most recent duel context and attacks so we can keep the duel
  // stage alive briefly after the phase returns to main (auto-resolve notice).
  useEffect(() => {
    if (!gameState) return;
    if (isDuelTurnPhase(gameState.phase) && gameState.duelContext) {
      lastDuelCtxRef.current = gameState.duelContext as import("@workspace/api-client-react").DuelContext;
      lastDuelAttacksRef.current = gameState.attacks as import("@workspace/api-client-react").AttackDeclaration[];
    }
  }, [gameState]);

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

    // Turn changes.
    if (prevActivePlayerRef.current && prevActivePlayerRef.current !== gameState.activePlayerId) {
      pushEvent(colorOf(gameState.activePlayerId), `${nameOf(gameState.activePlayerId)} — turn ${gameState.turnNumber}`);
    }
    prevActivePlayerRef.current = gameState.activePlayerId;

    // Attack declarations (entering declare_blocks).
    if (prev !== "declare_blocks" && gameState.phase === "declare_blocks") {
      const byAttacker = new Map<string, Map<string, number>>();
      for (const a of gameState.attacks) {
        const inner = byAttacker.get(a.attackerPlayerId) ?? new Map<string, number>();
        inner.set(a.targetPlayerId, (inner.get(a.targetPlayerId) ?? 0) + 1);
        byAttacker.set(a.attackerPlayerId, inner);
      }
      for (const [atkId, targets] of byAttacker) {
        for (const [tgtId, n] of targets) {
          pushEvent(
            colorOf(atkId),
            `${nameOf(atkId)} attacks ${nameOf(tgtId)} with ${n} Royal${n > 1 ? "s" : ""}`,
          );
        }
      }
    }

    // Club plays.
    const pendingClubKey = gameState.pendingClubDebuff
      ? `${gameState.pendingClubDebuff.clubCardId}:${gameState.pendingClubDebuff.targetRoyalId}`
      : null;
    if (pendingClubKey && pendingClubKey !== prevPendingClubRef.current && gameState.pendingClubDebuff) {
      const c = gameState.pendingClubDebuff;
      pushEvent(
        colorOf(c.attackerPlayerId),
        `${nameOf(c.attackerPlayerId)} plays a Club on ${nameOf(c.targetPlayerId)}'s Royal`,
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

    // Life / court / elimination diffs → ticker (+ toast for big combat hits).
    const damageParts: string[] = [];
    for (const [id, p] of Object.entries(gameState.players)) {
      const before = prevPlayers[id];
      if (!before) continue;
      const lifeDelta = p.life - before.life;
      if (lifeDelta < 0) {
        pushEvent(colorOf(id), `${nameOf(id)} took ${-lifeDelta} damage (❤ ${p.life})`);
        damageParts.push(`${nameOf(id)} took ${-lifeDelta} damage`);
      } else if (lifeDelta > 0) {
        pushEvent(colorOf(id), `${nameOf(id)} healed +${lifeDelta} (❤ ${p.life})`);
      }
      const courtLost = before.courtSize - p.court.length;
      if (courtLost > 0) {
        pushEvent(colorOf(id), `${nameOf(id)} lost ${courtLost} Royal${courtLost > 1 ? "s" : ""}`);
        damageParts.push(`${nameOf(id)} lost ${courtLost} Royal${courtLost > 1 ? "s" : ""}`);
      }
      if (!before.eliminated && p.isEliminated) {
        pushEvent(colorOf(id), `☠ ${nameOf(id)} is eliminated!`);
        showToast(`☠ ${nameOf(id)} has been eliminated`, "info");
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

        if (lastDuelCtxRef.current) {
          // Keep the duel stage open with the notice until the player taps OK.
          pendingCombatDamageRef.current = damageParts;
          setAutoPassMessage(message);
        } else {
          showToast([message, ...damageParts].join(" · "), "info");
        }
      } else if (damageParts.length > 0) {
        showToast(`⚔ ${damageParts.join(" · ")}`, "info");
      }
    }

    prevPhaseRef.current = gameState.phase;
    prevPlayersRef.current = Object.fromEntries(
      Object.entries(gameState.players).map(([id, p]) => [
        id,
        { life: p.life, courtSize: p.court.length, eliminated: !!p.isEliminated },
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
        router.replace({
          pathname: "/(game)/game-over",
          params: { matchId: matchId ?? "" },
        });
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
          hasNavigatedRef.current = true;
          router.replace({
            pathname: "/(game)/game-over",
            params: { matchId, winnerUserId: data.winnerUserId },
          });
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
      submitAction({ matchId, data: body });
    },
    [matchId, gameState, user, submitAction, showToast],
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

  const handleDismissAutoPass = useCallback(() => {
    const parts = pendingCombatDamageRef.current;
    if (parts.length > 0) showToast(parts.join(" · "), "info");
    setAutoPassMessage(null);
    lastDuelCtxRef.current = null;
    pendingCombatDamageRef.current = [];
  }, [showToast]);

  if (isLoading && !gameState) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={["#0A0A0F", "#0C0D18"]} style={StyleSheet.absoluteFill} />
        <ActivityIndicator size="large" color={Colors.brand} />
        <Text style={styles.loadingText}>Loading game...</Text>
      </View>
    );
  }

  if (!gameState) {
    return (
      <View style={[styles.container, styles.centered]}>
        <LinearGradient colors={["#0A0A0F", "#0C0D18"]} style={StyleSheet.absoluteFill} />
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
  const showDuelStage = (inDuel && !!duelCtx) || !!autoPassMessage;
  const effectiveDuelCtx = duelCtx ?? lastDuelCtxRef.current;
  const effectiveDuelAttacks = inDuel ? gameState.attacks : lastDuelAttacksRef.current;

  const nameFor = (id: string) =>
    id === myId ? "You" : (displayNames[id] ?? id.slice(0, 8));
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

  // Cards that also offer instant (no-target) options — Diamonds (Mine/Draw),
  // Royals (to Court), or disabled info rows — surface EVERY option as a dock
  // chip so nothing hides behind a tap-a-target hint. Tapping a targeted chip
  // "arms" it (setArmedAction) and the board highlights its legal targets.
  // Pure-target cards (Hearts/Spades/Clubs/Joker) keep the faster model: no
  // chips, just tap a glowing target directly.
  const hasInstantChips = selectedActions.some(
    (a) => a.disabled || !a.requiresTarget || a.targetType === "pick_abyss",
  );

  const dockChipActions = armedAction ? [] : hasInstantChips ? selectedActions : [];

  const dockTargetHints = armedAction
    ? [targetHintFor(armedAction, selectedCard?.pipValue ?? 0) ?? "Tap a target on the board"]
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
    setSelectedAttackRoyalIds(new Set());
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
      <LinearGradient colors={["#0D2B1A", "#0A1F13", "#0D2B1A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

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
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
      >
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
            />
          ) : showDuelStage && effectiveDuelCtx ? (
            <DuelStage
              phase={phase}
              attacks={effectiveDuelAttacks.filter(
                (a) =>
                  a.blockerCardIds &&
                  a.blockerCardIds.length > 0 &&
                  a.attackerPlayerId === effectiveDuelCtx.attackerPlayerId &&
                  a.targetPlayerId === effectiveDuelCtx.defenderPlayerId,
              )}
              duelContext={effectiveDuelCtx}
              myId={myId}
              attackerCourt={gameState.players[effectiveDuelCtx.attackerPlayerId]?.court ?? []}
              defenderCourt={gameState.players[effectiveDuelCtx.defenderPlayerId]?.court ?? []}
              displayNames={displayNames}
              attackerColor={colorOf(effectiveDuelCtx.attackerPlayerId)}
              defenderColor={colorOf(effectiveDuelCtx.defenderPlayerId)}
              isSubmitting={isSubmitting}
              autoPassMessage={autoPassMessage}
              remainingOpponentIds={gameState.duelQueue ?? []}
              onPass={handleDuelPass}
              onDismissAutoPass={handleDismissAutoPass}
            />
          ) : inRespondToClub && pendingClub ? (
            <Animated.View entering={FadeIn.duration(250)} style={styles.clubPanel}>
              <View style={styles.clubPanelHeader}>
                <Ionicons name="warning" size={16} color="#C89B3C" />
                <Text style={styles.clubPanelTitle}>
                  {isClubResponder
                    ? `${clubAttackerName} plays a Club on your Royal!`
                    : `${clubAttackerName}'s Club → ${clubDefenderName}'s Royal`}
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
                  <CardView cardId={pendingClub.targetRoyalId} size="sm" />
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
                        Strengthen your Royal with Hearts, Spades, Clubs or a Joker — or accept it.
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
              <Text style={styles.waitingText}>Waiting for {activePlayerName}…</Text>
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
            />
          </View>
        )}
      </ScrollView>

      {/* ---- Mode strips & action bar (pinned above the hand) ---- */}
      {attackSelectMode && !assigningTargets && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.modeStrip}>
          <Ionicons name="flash" size={14} color={Colors.accentRed} />
          <Text style={styles.modeStripText}>
            Tap your Royals to pick attackers
            {selectedAttackRoyalIds.size > 0 ? ` — ${selectedAttackRoyalIds.size} chosen` : ""}
          </Text>
        </Animated.View>
      )}

      {assigningTargets && (
        <Animated.View entering={FadeInDown.duration(180)} style={styles.modeStripColumn}>
          <View style={styles.modeStripRow}>
            <Ionicons name="flash" size={14} color={Colors.accentRed} />
            <Text style={styles.modeStripText}>
              {activeAssignRoyalId
                ? `Send ${parseCardId(activeAssignRoyalId).displayRank}${parseCardId(activeAssignRoyalId).suitSymbol} — tap an opponent's name`
                : "Every Royal has a target — declare below"}
            </Text>
          </View>
          {selectedAttackRoyalIds.size > 1 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.assignChipRow}>
              {Array.from(selectedAttackRoyalIds).map((royalId) => {
                const card = parseCardId(royalId);
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
                      {card.displayRank}{card.suitSymbol}
                    </Text>
                    <Text style={styles.assignChipTarget} numberOfLines={1}>
                      {assignedTo ? `→ ${nameFor(assignedTo)}` : "no target"}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>
          )}
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
      {(showAttackButton || canEndTurn || attackSelectMode || assigningTargets) && (
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
      {selectedCardId && abyssPickerAction ? (
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

      <ToastHost toasts={toasts} />
    </View>
  );
}

const styles = StyleSheet.create({
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
