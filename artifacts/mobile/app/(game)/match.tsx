import React, { useEffect, useRef, useState, useCallback } from "react";
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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeIn,
  FadeOut,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  useAnimatedStyle,
} from "react-native-reanimated";
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
import Colors from "@/constants/colors";
import HandTray from "@/components/game/HandTray";
import CourtZone from "@/components/game/CourtZone";
import OpponentPanel from "@/components/game/OpponentPanel";
import MineAbyssRow from "@/components/game/MineAbyssRow";
import CardActionSheet from "@/components/game/CardActionSheet";
import type { ActionParams } from "@/components/game/CardActionSheet";
import BlockingModal from "@/components/game/BlockingModal";
import DuelPhaseModal from "@/components/game/DuelPhaseModal";
import DamageOrderModal from "@/components/game/DamageOrderModal";
import CardView from "@/components/game/CardView";
import { parseCardId, isDuelTurnPhase, isInterruptPhase, effectiveAttack, effectiveHealth, canPlayerInitiateInterrupt } from "@/lib/gameUtils";
import type { CardAction } from "@/lib/gameUtils";

export default function MatchScreen() {
  const { matchId } = useLocalSearchParams<{ matchId: string }>();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const topInset = Platform.OS === "web" ? 67 : insets.top;
  const bottomInset = Platform.OS === "web" ? 34 : insets.bottom;

  const [gameState, setGameState] = useState<PlayerGameView | null>(null);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedTargetRoyalId, setSelectedTargetRoyalId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [combatResultText, setCombatResultText] = useState<string | null>(null);
  const [autoPassMessage, setAutoPassMessage] = useState<string | null>(null);

  const [attackSelectMode, setAttackSelectMode] = useState(false);
  const [selectedAttackRoyalIds, setSelectedAttackRoyalIds] = useState<Set<string>>(new Set());
  const [assigningTargets, setAssigningTargets] = useState(false);
  const [targetAssignments, setTargetAssignments] = useState<Record<string, string>>({});
  const [activeAssignRoyalId, setActiveAssignRoyalId] = useState<string | null>(null);
  const [blockingMinimized, setBlockingMinimized] = useState(false);

  const prevPhaseRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<Record<string, { life: number; courtSize: number }>>({});
  const lastDuelCtxRef = useRef<import("@workspace/api-client-react").DuelContext | null>(null);
  const lastDuelAttacksRef = useRef<import("@workspace/api-client-react").AttackDeclaration[]>([]);
  const pendingCombatDamageRef = useRef<string[]>([]);

  const pulseOpacity = useSharedValue(1);
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulseOpacity.value }));

  useEffect(() => {
    pulseOpacity.value = withRepeat(
      withSequence(withTiming(0.3, { duration: 700 }), withTiming(1, { duration: 700 })),
      -1,
    );
  }, []);

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

  // Track the most recent duel context and attacks so we can keep the modal
  // alive briefly after the phase returns to main (for auto-resolve messaging).
  useEffect(() => {
    if (!gameState) return;
    if (isDuelTurnPhase(gameState.phase) && gameState.duelContext) {
      lastDuelCtxRef.current = gameState.duelContext as import("@workspace/api-client-react").DuelContext;
      lastDuelAttacksRef.current = gameState.attacks as import("@workspace/api-client-react").AttackDeclaration[];
    }
  }, [gameState]);

  // Detect combat resolution: duel phase → main
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const prevPlayers = prevPlayersRef.current;
    const effectMyId = user?.id ?? "";
    const nameOf = (id: string) =>
      id === effectMyId ? "You" : (displayNames[id] ?? id.slice(0, 8));

    const wasDuel =
      prev === "duel_attacker_turn" ||
      prev === "duel_blocker_turn";
    const wasCombat =
      wasDuel ||
      prev === "declare_blocks" ||
      prev === "assign_damage_order";
    const nowResolved = gameState.phase === "main" || gameState.phase === "draw";

    // Detect declare_blocks → duel/assign_damage_order: show immediate unblocked damage
    const enteredDuelFromBlocks =
      prev === "declare_blocks" &&
      (gameState.phase === "duel_blocker_turn" ||
        gameState.phase === "duel_attacker_turn" ||
        gameState.phase === "assign_damage_order");

    if (enteredDuelFromBlocks) {
      const immediateParts: string[] = [];
      for (const [id, p] of Object.entries(gameState.players)) {
        const before = prevPlayers[id];
        if (!before) continue;
        const lifeDelta = p.life - before.life;
        if (lifeDelta < 0) {
          const name = nameOf(id);
          immediateParts.push(`${name} took ${-lifeDelta} direct damage`);
        }
      }
      if (immediateParts.length > 0) {
        setCombatResultText(immediateParts.join(" · "));
        setTimeout(() => setCombatResultText(null), 3500);
      }
    }

    if (wasCombat && nowResolved) {
      const autoPassedIds = gameState.lastCombatSummary?.autoPassedPlayerIds ?? [];

      const damageParts: string[] = [];
      for (const [id, p] of Object.entries(gameState.players)) {
        const before = prevPlayers[id];
        if (!before) continue;
        const lifeDelta = p.life - before.life;
        if (lifeDelta < 0) {
          const name = nameOf(id);
          damageParts.push(`${name} took ${-lifeDelta} damage`);
        }
        const courtLost = before.courtSize - p.court.length;
        if (courtLost > 0) {
          const name = nameOf(id);
          damageParts.push(`${name} lost ${courtLost} Royal${courtLost > 1 ? "s" : ""}`);
        }
      }

      if (autoPassedIds.length > 0) {
        const bothPlayers = autoPassedIds.length >= 2;
        let message: string;
        if (bothPlayers) {
          message = "No cards left to play — resolving combat";
        } else {
          const passedId = autoPassedIds[0]!;
          const localMyId = user?.id ?? "";
          message = passedId === localMyId
            ? "You had no cards to play"
            : `${displayNames[passedId] ?? passedId.slice(0, 8)} had no cards to play`;
        }

        if (lastDuelCtxRef.current) {
          // Modal hold path: duel phase was observed — keep the duel panel open
          // showing the auto-pass message until the player taps "Pass".
          pendingCombatDamageRef.current = damageParts;
          setAutoPassMessage(message);
        } else {
          // Fallback banner path: combat resolved immediately from declare_blocks
          // without entering a duel turn — show message in combat result banner.
          const allParts = [message, ...damageParts];
          setCombatResultText(allParts.join(" · "));
          setTimeout(() => setCombatResultText(null), 5000);
        }
      } else if (damageParts.length > 0) {
        setCombatResultText(damageParts.join(" · "));
        setTimeout(() => setCombatResultText(null), 4000);
      }
    }

    prevPhaseRef.current = gameState.phase;
    prevPlayersRef.current = Object.fromEntries(
      Object.entries(gameState.players).map(([id, p]) => [
        id,
        { life: p.life, courtSize: p.court.length },
      ]),
    );
  }, [gameState]);

  // Clear selected card when entering respond_to_club or duel phases
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase === "respond_to_club" || isDuelTurnPhase(gameState.phase)) {
      setSelectedCardId(null);
    }
    if (gameState.phase !== "main") {
      setAttackSelectMode(false);
      setSelectedAttackRoyalIds(new Set());
      setAssigningTargets(false);
      setTargetAssignments({});
      setActiveAssignRoyalId(null);
    }
    if (gameState.phase !== "declare_blocks") {
      setBlockingMinimized(false);
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
        Alert.alert("Error", "Failed to end the game. Please try again.");
      },
    },
  });

  const handleAbandon = useCallback(() => {
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
        setSelectedTargetRoyalId(null);
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
            ? `Action failed (HTTP ${errObj.status}${errObj.statusText ? " " + errObj.statusText : ""})`
            : "Action failed — could not reach the server";
        }
        Alert.alert("Action rejected", msg);
      },
    },
  });

  const handleAction = useCallback(
    (params: ActionParams) => {
      if (!matchId) return;

      const myId = user?.id ?? "";
      const phase = gameState?.phase ?? "";
      const inDuel = isDuelTurnPhase(phase);
      const duelCtx = gameState?.duelContext;

      const actingAsDefender =
        phase === "declare_blocks" &&
        gameState?.attacks.some((a) => a.targetPlayerId === myId);
      const actingAsClubResponder =
        phase === "respond_to_club" &&
        gameState?.pendingClubDebuff?.targetPlayerId === myId;
      const actingAsDuelParticipant =
        inDuel && duelCtx &&
        (myId === duelCtx.attackerPlayerId || myId === duelCtx.defenderPlayerId);
      const actingAsInterrupter =
        phase === "interrupt_window" &&
        gameState?.interruptStack?.priorityPlayerId === myId;
      // A non-active bystander may open a fresh interrupt window during any
      // other player's turn/phase. The server validates the specific action
      // (and rejects ineligible ones), so we only need a coarse gate here.
      const actingAsInterruptInitiator =
        !!gameState &&
        gameState.activePlayerId !== myId &&
        phase !== "interrupt_window" &&
        !actingAsDefender &&
        !actingAsClubResponder &&
        !actingAsDuelParticipant &&
        !gameState.players?.[myId]?.isEliminated;

      if (
        gameState?.activePlayerId !== myId &&
        !actingAsDefender &&
        !actingAsClubResponder &&
        !actingAsDuelParticipant &&
        !actingAsInterrupter &&
        !actingAsInterruptInitiator
      ) {
        Alert.alert("Not your turn", "The turn has moved on. Please wait.");
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
          Alert.alert("Card not in hand", "That card is no longer in your hand.");
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
    [matchId, gameState, user, submitAction],
  );

  const handleEndTurn = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "end_turn" } });
  }, [matchId, submitAction]);

  const handleConfirmClubResponse = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "confirm_club_response" } });
  }, [matchId, submitAction]);

  const handleAttack = useCallback((targets: { targetPlayerId: string; royalCardIds: string[] }[]) => {
    if (!matchId || targets.length === 0) return;
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

  const handleInterruptPass = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "interrupt_pass" } });
  }, [matchId, submitAction]);

  const handleDismissAutoPass = useCallback(() => {
    setAutoPassMessage(null);
    lastDuelCtxRef.current = null;
    pendingCombatDamageRef.current = [];
  }, []);

  const handleDuelPlayCard = useCallback((cardId: string) => {
    setSelectedCardId(cardId);
  }, []);

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
  const isClubAttacker = inRespondToClub && pendingClub?.attackerPlayerId === myId;
  const targetedClubRoyal = pendingClub
    ? gameState.players[pendingClub.targetPlayerId]?.court.find(
        (r) => r.cardId === pendingClub.targetRoyalId,
      )
    : undefined;

  const vault = myState?.vault.available ?? 0;

  // A non-active, non-eliminated player who is not the current action-window
  // holder may open a fresh interrupt during any other player's turn/phase —
  // including duels. During a duel the game's activePlayerId stays the original
  // attacker, so `isMyTurn` alone would wrongly block that attacker from
  // interrupting on the *defender's* duel turn; while a duel is in progress the
  // only player barred from initiating is the current duel turn-holder. The
  // server enforces which specific cards/actions are eligible.
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

  const showBlockingModal = isDefender;
  const waitingOnOtherDefenders =
    inDeclareBlocks && attacksTargetingMe.length > 0 && !stillNeedToSubmitBlocks;
  const showDamageOrderModal = inAssignDamageOrder && duelCtx && myId === duelCtx.attackerPlayerId;
  const showDuelModal = (inDuel && !!duelCtx) || !!autoPassMessage;
  const effectiveDuelCtx = duelCtx ?? lastDuelCtxRef.current;
  const effectiveDuelAttacks = inDuel ? gameState.attacks : lastDuelAttacksRef.current;

  const activePlayerName = displayNames[gameState.activePlayerId]
    ?? (gameState.activePlayerId === myId ? (user?.displayName ?? "You") : gameState.activePlayerId.slice(0, 8));

  const nameFor = (id: string) =>
    id === myId ? "You" : (displayNames[id] ?? id.slice(0, 8));
  const clubAttackerName = pendingClub ? nameFor(pendingClub.attackerPlayerId) : "";
  const clubDefenderName = pendingClub ? nameFor(pendingClub.targetPlayerId) : "";

  const handleCardPress = (cardId: string) => {
    if (attackSelectMode) return;
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const handleToggleAttackRoyal = (royalId: string) => {
    const royal = myState?.court.find((r) => r.cardId === royalId);
    if (!royal || royal.hasAttackedThisTurn || royal.hasteLocked) return;
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

  const handleAssignRoyalTarget = (opponentId: string) => {
    if (!activeAssignRoyalId) return;
    setTargetAssignments((prev) => {
      const next = { ...prev, [activeAssignRoyalId]: opponentId };
      const remainingUnassigned = Array.from(selectedAttackRoyalIds).find((id) => !next[id]);
      setActiveAssignRoyalId(remainingUnassigned ?? null);
      return next;
    });
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

  const handleOwnRoyalPress = (royalId: string) => {
    if (attackSelectMode) {
      handleToggleAttackRoyal(royalId);
      return;
    }
    const canPlay = (isMyTurn && inMainPhase) || (isDefender && inDeclareBlocks) || isClubResponder || !!isMyDuelTurn || !!isMyInterruptTurn;
    if (!canPlay) return;

    if (selectedCardId) {
      const card = parseCardId(selectedCardId);
      if (card.suit === "H" && vault >= card.vaultCost) {
        handleAction({ cardId: selectedCardId, action: "attach_heart", targetRoyalId: royalId });
        setSelectedCardId(null);
        return;
      }
      if (card.suit === "S" && vault >= card.vaultCost) {
        handleAction({ cardId: selectedCardId, action: "attach_spade", targetRoyalId: royalId });
        setSelectedCardId(null);
        return;
      }
    }

    setSelectedTargetRoyalId(royalId === selectedTargetRoyalId ? null : royalId);
  };

  const handleOpponentRoyalPress = (royalId: string, targetPlayerId: string) => {
    if (!isMyTurn && !isDefender && !isClubResponder && !isMyDuelTurn && !isMyInterruptTurn) return;
    if (!selectedCardId) return;
    const card = parseCardId(selectedCardId);

    if (card.suit === "C") {
      handleAction({ cardId: selectedCardId, action: "apply_club", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    } else if (card.suit === "H" && vault >= card.vaultCost) {
      handleAction({ cardId: selectedCardId, action: "attach_heart", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    } else if (card.suit === "S" && vault >= card.vaultCost) {
      handleAction({ cardId: selectedCardId, action: "attach_spade", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    } else if (card.isJoker && isMyTurn) {
      handleAction({ cardId: selectedCardId, action: "play_joker", mode: "destroy_royal", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    }
  };

  const handleAttackButtonPress = () => {
    setSelectedCardId(null);
    setAttackSelectMode(true);
    setSelectedAttackRoyalIds(new Set());
  };

  const handleOpponentPanelPress = (opponentId: string) => {
    if (!assigningTargets || !isMyTurn || !inMainPhase) return;
    handleAssignRoyalTarget(opponentId);
  };

  const isPickingAttackTarget = assigningTargets;

  const ineligibleRoyalIds = new Set(
    (myState?.court ?? [])
      .filter((r) => r.hasAttackedThisTurn || r.hasteLocked)
      .map((r) => r.cardId),
  );

  // Royals involved in the current duel, grouped by owner, so the board can
  // highlight exactly which cards are fighting (no guessing which to target).
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

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0D2B1A", "#0A1F13", "#0D2B1A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.phaseTag,
            inRespondToClub && styles.phaseTagClub,
            inDuel && styles.phaseTagDuel,
            attackSelectMode && styles.phaseTagAttack,
            inAssignDamageOrder && styles.phaseTagDuel,
          ]}>
            <Text style={[
              styles.phaseText,
              inRespondToClub && styles.phaseTextClub,
              inDuel && styles.phaseTextDuel,
              attackSelectMode && styles.phaseTextAttack,
              inAssignDamageOrder && styles.phaseTextDuel,
            ]}>
              {attackSelectMode ? "SELECT ROYALS" : phase.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <Pressable
            onPress={handleAbandon}
            style={({ pressed }) => [styles.endGameBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.endGameBtnText}>⚑ End Game</Text>
          </Pressable>
        </View>

        <View style={[styles.headerCenter, { paddingTop: topInset + 8, paddingBottom: 12 }]} pointerEvents="none">
          {attackSelectMode ? (
            <View style={styles.attackSelectBadge}>
              <Ionicons name="flash" size={13} color={Colors.bgDeep} />
              <Text style={styles.attackSelectBadgeText}>SELECT TO ATTACK</Text>
            </View>
          ) : isMyTurn && !inDuel ? (
            <View style={styles.myTurnBadge}>
              <Text style={styles.myTurnText}>YOUR TURN</Text>
            </View>
          ) : isMyDuelTurn ? (
            <View style={styles.duelTurnBadge}>
              <Ionicons name="flash" size={13} color={Colors.bgDeep} />
              <Text style={styles.duelTurnText}>DUEL — YOUR MOVE</Text>
            </View>
          ) : isMyInterruptTurn ? (
            <View style={styles.interruptTurnBadge}>
              <Ionicons name="hand-left" size={13} color={Colors.bgDeep} />
              <Text style={styles.interruptTurnText}>INTERRUPT — YOUR MOVE</Text>
            </View>
          ) : isClubResponder ? (
            <View style={styles.clubResponderBadge}>
              <Text style={styles.clubResponderBadgeText}>RESPOND TO CLUB</Text>
            </View>
          ) : (
            <Text style={styles.turnText}>
              {activePlayerName}&apos;s Turn
            </Text>
          )}
          <Text style={styles.turnSub}>Turn {gameState.turnNumber}</Text>
        </View>

        <View style={styles.headerRight}>
          <View style={styles.vaultDisplay}>
            <Text style={styles.vaultIcon}>⚡</Text>
            <Text style={styles.vaultValue}>{vault}</Text>
          </View>
          <View style={styles.lifeDisplay}>
            <Text style={styles.lifeIcon}>♥</Text>
            <Text style={styles.lifeValue}>{myState?.life ?? 0}</Text>
          </View>
        </View>
      </View>

      <ScrollView
        style={styles.board}
        contentContainerStyle={styles.boardContent}
        showsVerticalScrollIndicator={false}
      >
        {opponents.length > 0 && (
          <Animated.View entering={FadeIn.duration(400)} style={styles.opponentSection}>
            {isPickingAttackTarget && (
              <View style={styles.attackTargetBanner}>
                <Ionicons name="flash" size={14} color={Colors.accentRed} />
                <Text style={styles.attackTargetText}>
                  {activeAssignRoyalId
                    ? `Tap an opponent to send ${parseCardId(activeAssignRoyalId).displayRank}${parseCardId(activeAssignRoyalId).suitSymbol} (${parseCardId(activeAssignRoyalId).pipValue} dmg) at`
                    : "All Royals have a target — review and declare below"}
                </Text>
                <Pressable onPress={handleCancelAssignTargets} style={styles.cancelAttackBtn}>
                  <Text style={styles.cancelAttackText}>Back</Text>
                </Pressable>
              </View>
            )}
            {isPickingAttackTarget && selectedAttackRoyalIds.size > 1 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.assignRoyalRow}
                contentContainerStyle={styles.assignRoyalRowContent}
              >
                {Array.from(selectedAttackRoyalIds).map((royalId) => {
                  const card = parseCardId(royalId);
                  const assignedTo = targetAssignments[royalId];
                  const assignedName = assignedTo ? (displayNames[assignedTo] ?? assignedTo.slice(0, 8)) : null;
                  const isActive = activeAssignRoyalId === royalId;
                  return (
                    <Pressable
                      key={royalId}
                      onPress={() => handleSelectRoyalForAssign(royalId)}
                      style={({ pressed }) => [
                        styles.assignRoyalChip,
                        isActive && styles.assignRoyalChipActive,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.assignRoyalChipCard, { color: card.suitColor }]}>
                        {card.displayRank}{card.suitSymbol}
                        <Text style={styles.assignRoyalChipValue}> ⚔{card.pipValue}</Text>
                      </Text>
                      <Text style={styles.assignRoyalChipTarget} numberOfLines={1}>
                        {assignedName ? `→ ${assignedName}` : "No target"}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
            {opponents.map((opp) => {
              const targetedRoyalIds = Object.entries(targetAssignments)
                .filter(([, targetId]) => targetId === opp.id)
                .map(([royalId]) => royalId);
              return (
                <Pressable
                  key={opp.id}
                  onPress={() => handleOpponentPanelPress(opp.id)}
                  disabled={!isPickingAttackTarget || opp.isEliminated || !activeAssignRoyalId}
                  style={({ pressed }) => [
                    isPickingAttackTarget && !opp.isEliminated && !!activeAssignRoyalId && styles.attackTargetHighlight,
                    pressed && isPickingAttackTarget && !opp.isEliminated && !!activeAssignRoyalId && { opacity: 0.75 },
                  ]}
                >
                  <OpponentPanel
                    player={opp}
                    displayName={displayNames[opp.id] ?? opp.id.slice(0, 8)}
                    isActive={gameState.activePlayerId === opp.id}
                    isEliminated={opp.isEliminated}
                    attackingYouWith={
                      (inDeclareBlocks || inDuel || inAssignDamageOrder)
                        ? attacksTargetingMe
                            .filter((a) => a.attackerPlayerId === opp.id)
                            .map((a) => a.attackerCardId)
                        : undefined
                    }
                    duelingIds={duelRoyalIdsByPlayer[opp.id]}
                    onRoyalPress={
                      ((isMyTurn && inMainPhase) || isClubResponder || !!isMyDuelTurn) && !opp.isEliminated && selectedCardId
                        ? (royalId) => handleOpponentRoyalPress(royalId, opp.id)
                        : undefined
                    }
                  />
                  {isPickingAttackTarget && targetedRoyalIds.length > 0 && (
                    <View style={styles.assignedRoyalsBadge}>
                      <Ionicons name="flash" size={11} color={Colors.accentRed} />
                      <Text style={styles.assignedRoyalsBadgeText}>
                        {targetedRoyalIds.length} attacker{targetedRoyalIds.length !== 1 ? "s" : ""} assigned
                      </Text>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Animated.View>
        )}

        <MineAbyssRow
          mine={gameState.mine ?? []}
          abyss={gameState.abyss}
          deckCount={gameState.deck}
        />

        {/* Club Response Window Banner */}
        {inRespondToClub && pendingClub && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.clubResponseBanner}>
            <View style={styles.clubResponseHeader}>
              <Ionicons name="warning" size={18} color="#C89B3C" />
              <Text style={styles.clubResponseTitle}>
                {isClubResponder
                  ? `${clubAttackerName} is playing a Club against your Royal!`
                  : `Waiting for ${clubDefenderName} to respond to Club…`}
              </Text>
            </View>
            {pendingClub && (
              <View style={styles.clubResponseDetails}>
                <View style={styles.clubCardPreview}>
                  <Text style={styles.clubResponseLabel}>Club played:</Text>
                  <CardView cardId={pendingClub.clubCardId} size="sm" />
                </View>
                <View style={styles.clubCardPreview}>
                  <Text style={styles.clubResponseLabel}>Targeting:</Text>
                  <CardView cardId={pendingClub.targetRoyalId} size="sm" />
                  {targetedClubRoyal && (
                    <View style={styles.clubRoyalStats}>
                      <View style={styles.clubStatPill}>
                        <Text style={styles.clubStatPillAtk}>
                          ⚔ {effectiveAttack(targetedClubRoyal.cardId, targetedClubRoyal.buffAttack)}
                        </Text>
                      </View>
                      <View style={styles.clubStatPill}>
                        <Text style={styles.clubStatPillHp}>
                          ♥ {effectiveHealth(targetedClubRoyal.cardId, targetedClubRoyal.buffHealth, targetedClubRoyal.damageTaken)}
                        </Text>
                      </View>
                    </View>
                  )}
                </View>
              </View>
            )}
            {isClubResponder && (
              <Text style={styles.clubResponseHint}>
                Play Hearts, Spades, Clubs, or Jokers to strengthen your Royal. You may also discard one Diamond to draw or gain Vault — but not add it to the Mine.
              </Text>
            )}
          </Animated.View>
        )}

        {/* Interrupt window banner: priority + pending LIFO stack */}
        {inInterrupt && interruptStack && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.interruptBanner}>
            <View style={styles.interruptHeader}>
              <Ionicons name="hand-left" size={18} color="#5AB0FF" />
              <Text style={styles.interruptTitle}>
                {isMyInterruptTurn
                  ? "You have priority — play an interrupt or pass"
                  : `Interrupt window — waiting for ${
                      displayNames[interruptStack.priorityPlayerId]
                        ?? interruptStack.priorityPlayerId.slice(0, 8)
                    }`}
              </Text>
            </View>
            {interruptStack.entries.length > 0 && (
              <View style={styles.interruptStackList}>
                <Text style={styles.interruptStackLabel}>
                  Pending stack (resolves top-first):
                </Text>
                {[...interruptStack.entries].reverse().map((entry, i) => {
                  const entryName =
                    displayNames[entry.playerId] ?? entry.playerId.slice(0, 8);
                  const entryCardId =
                    (entry.action as { cardId?: string; clubCardId?: string; heartCardId?: string; spadeCardId?: string; supportCardId?: string }).cardId
                    ?? (entry.action as { clubCardId?: string }).clubCardId
                    ?? (entry.action as { heartCardId?: string }).heartCardId
                    ?? (entry.action as { spadeCardId?: string }).spadeCardId
                    ?? (entry.action as { supportCardId?: string }).supportCardId;
                  return (
                    <View
                      key={`${entry.playerId}-${i}`}
                      style={styles.interruptStackEntry}
                    >
                      <Text style={styles.interruptStackIndex}>
                        {i === 0 ? "▲" : i + 1}
                      </Text>
                      {entryCardId ? (
                        <CardView cardId={entryCardId} size="sm" />
                      ) : null}
                      <View style={styles.interruptStackMeta}>
                        <Text style={styles.interruptStackPlayer}>{entryName}</Text>
                        <Text style={styles.interruptStackAction}>
                          {String(entry.action.type).replace(/_/g, " ")}
                        </Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}
            {isMyInterruptTurn && (
              <Pressable
                onPress={handleInterruptPass}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.interruptPassBtn, pressed && { opacity: 0.8 }]}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.bgDeep} />
                ) : (
                  <>
                    <Ionicons name="arrow-forward-circle" size={16} color={Colors.bgDeep} />
                    <Text style={styles.interruptPassText}>Pass Priority</Text>
                  </>
                )}
              </Pressable>
            )}
          </Animated.View>
        )}

        {/* Attack Royal selection banner */}
        {attackSelectMode && !assigningTargets && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.attackSelectBanner}>
            <Ionicons name="flash" size={16} color={Colors.accentRed} />
            <Text style={styles.attackSelectBannerText}>
              Tap your Royals below to select attackers.
              {selectedAttackRoyalIds.size > 0
                ? ` ${selectedAttackRoyalIds.size} selected.`
                : " Tapped/ineligible Royals are dimmed."}
            </Text>
          </Animated.View>
        )}

        {/* Assign damage order banner */}
        {inAssignDamageOrder && duelCtx && myId === duelCtx.attackerPlayerId && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.damageOrderBanner}>
            <Ionicons name="list" size={16} color={Colors.brand} />
            <Text style={styles.damageOrderBannerText}>
              Set the order your attackers deal damage to grouped blockers.
            </Text>
          </Animated.View>
        )}
        {inAssignDamageOrder && duelCtx && myId !== duelCtx.attackerPlayerId && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              Waiting for attacker to set damage order…
            </Text>
          </View>
        )}

        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.myCourtSection}>
          <Text style={styles.sectionLabel}>
            {assigningTargets ? "ASSIGNING ATTACKERS" : attackSelectMode ? "TAP ROYALS TO SELECT" : "YOUR COURT"}
          </Text>
          <CourtZone
            court={myState?.court ?? []}
            isMyZone
            isMyTurn={isMyTurn}
            size="xl"
            phase={phase}
            isDefender={isDefender}
            onRoyalPress={
              attackSelectMode && !assigningTargets
                ? handleToggleAttackRoyal
                : assigningTargets
                  ? handleSelectRoyalForAssign
                  : (isMyTurn && inMainPhase && selectedCardId)
                  ? (royalId) => handleOwnRoyalPress(royalId)
                  : (isDefender && selectedCardId)
                    ? (royalId) => handleOwnRoyalPress(royalId)
                    : (isClubResponder && selectedCardId)
                      ? (royalId) => handleOwnRoyalPress(royalId)
                      : undefined
            }
            selectedTargetId={assigningTargets ? activeAssignRoyalId : selectedTargetRoyalId}
            highlightedIds={
              attackSelectMode
                ? selectedAttackRoyalIds
                : myDuelingIds && myDuelingIds.size > 0
                  ? myDuelingIds
                  : undefined
            }
            highlightBadgeText={
              !attackSelectMode && myDuelingIds && myDuelingIds.size > 0 ? "⚔ DUEL" : undefined
            }
            dimmedIds={attackSelectMode ? ineligibleRoyalIds : undefined}
          />
        </Animated.View>

        {inDiscardPhase && (
          <Animated.View entering={FadeIn.duration(300)} style={styles.discardBanner}>
            <Ionicons name="trash" size={16} color="#C89B3C" />
            <Text style={styles.discardBannerText}>
              Discard {discardCount} card{discardCount !== 1 ? "s" : ""} to end your turn
            </Text>
          </Animated.View>
        )}

        {/* Club response: Confirm button for the defender */}
        {isClubResponder && (
          <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.actionRow}>
            <Pressable
              onPress={handleConfirmClubResponse}
              disabled={isSubmitting}
              style={({ pressed }) => [styles.endTurnBtn, pressed && { opacity: 0.8 }]}
            >
              <LinearGradient
                colors={["#8B6A00", "#C89B3C"]}
                style={styles.endTurnBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color={Colors.bgDeep} />
                ) : (
                  <>
                    <Text style={[styles.endTurnText, { color: Colors.bgDeep }]}>Confirm — Apply Club</Text>
                    <Ionicons name="checkmark" size={18} color={Colors.bgDeep} />
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Attack selection mode buttons */}
        {attackSelectMode && !assigningTargets && (
          <Animated.View entering={FadeIn.duration(200)} style={styles.actionRow}>
            <Pressable
              onPress={() => {
                setAttackSelectMode(false);
                setSelectedAttackRoyalIds(new Set());
              }}
              style={({ pressed }) => [styles.cancelSelectBtn, pressed && { opacity: 0.8 }]}
            >
              <Ionicons name="close" size={18} color={Colors.textSecondary} />
              <Text style={styles.cancelSelectText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirmAttackSelection}
              disabled={selectedAttackRoyalIds.size === 0 || isSubmitting}
              style={({ pressed }) => [
                styles.attackBtn,
                (selectedAttackRoyalIds.size === 0 || isSubmitting) && styles.attackBtnDisabled,
                pressed && selectedAttackRoyalIds.size > 0 && { opacity: 0.8 },
              ]}
            >
              <LinearGradient
                colors={selectedAttackRoyalIds.size > 0 ? [Colors.accentRed, "#8B1A1A"] : [Colors.bgSurface, Colors.bgSurface]}
                style={styles.attackBtnGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#FFF" />
                ) : (
                  <>
                    <Ionicons name="flash" size={18} color={selectedAttackRoyalIds.size > 0 ? "#FFF" : Colors.textMuted} />
                    <Text style={[styles.attackBtnText, selectedAttackRoyalIds.size === 0 && { color: Colors.textMuted }]}>
                      {selectedAttackRoyalIds.size > 0
                        ? `Attack with ${selectedAttackRoyalIds.size} Royal${selectedAttackRoyalIds.size !== 1 ? "s" : ""}`
                        : "Select a Royal"}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Multi-target attack assignment buttons */}
        {assigningTargets && (() => {
          const allAssigned = Array.from(selectedAttackRoyalIds).every((id) => !!targetAssignments[id]);
          return (
            <Animated.View entering={FadeIn.duration(200)} style={styles.actionRow}>
              <Pressable
                onPress={handleCancelAssignTargets}
                style={({ pressed }) => [styles.cancelSelectBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="close" size={18} color={Colors.textSecondary} />
                <Text style={styles.cancelSelectText}>Cancel</Text>
              </Pressable>
              <Pressable
                onPress={handleDeclareMultiAttack}
                disabled={!allAssigned || isSubmitting}
                style={({ pressed }) => [
                  styles.attackBtn,
                  (!allAssigned || isSubmitting) && styles.attackBtnDisabled,
                  pressed && allAssigned && { opacity: 0.8 },
                ]}
              >
                <LinearGradient
                  colors={allAssigned ? [Colors.accentRed, "#8B1A1A"] : [Colors.bgSurface, Colors.bgSurface]}
                  style={styles.attackBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <Ionicons name="flash" size={18} color={allAssigned ? "#FFF" : Colors.textMuted} />
                      <Text style={[styles.attackBtnText, !allAssigned && { color: Colors.textMuted }]}>
                        {allAssigned ? "Declare Attack" : "Assign every Royal a target"}
                      </Text>
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            </Animated.View>
          );
        })()}

        {(canEndTurn || showAttackButton) && (
          <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.actionRow}>
            {showAttackButton && (
              <Pressable
                onPress={handleAttackButtonPress}
                style={({ pressed }) => [styles.attackBtn, pressed && { opacity: 0.8 }]}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={[Colors.accentRed, "#8B1A1A"]}
                  style={styles.attackBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="flash" size={18} color="#FFF" />
                  <Text style={styles.attackBtnText}>Attack!</Text>
                </LinearGradient>
              </Pressable>
            )}
            {canEndTurn && (
              <Pressable
                onPress={handleEndTurn}
                disabled={isSubmitting}
                style={({ pressed }) => [styles.endTurnBtn, pressed && { opacity: 0.8 }]}
              >
                <LinearGradient
                  colors={[Colors.brand, Colors.brandDim]}
                  style={styles.endTurnBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color={Colors.bgDeep} />
                  ) : (
                    <>
                      <Text style={styles.endTurnText}>End Turn</Text>
                      <Ionicons name="arrow-forward" size={18} color={Colors.bgDeep} />
                    </>
                  )}
                </LinearGradient>
              </Pressable>
            )}
          </Animated.View>
        )}

        {!isMyTurn && !inDeclareBlocks && !inRespondToClub && !inDuel && !inAssignDamageOrder && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              Waiting for {activePlayerName}...
            </Text>
          </View>
        )}
        {!isMyTurn && inDeclareBlocks && attacksTargetingMe.length === 0 && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>Others declaring blocks...</Text>
          </View>
        )}
        {waitingOnOtherDefenders && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              Blocks submitted — waiting for {(pendingBlockDefenders ?? [])
                .map((id) => nameFor(id))
                .join(", ")}...
            </Text>
          </View>
        )}
        {inRespondToClub && !isClubResponder && (
          <View style={styles.waitingBanner}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>
              Waiting for {clubDefenderName} to respond…
            </Text>
          </View>
        )}
      </ScrollView>

      {combatResultText && (
        <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(500)} style={styles.combatResultBanner}>
          <Ionicons name="flash" size={14} color={Colors.accentRed} />
          <Text style={styles.combatResultText}>{combatResultText}</Text>
        </Animated.View>
      )}

      <BlockingModal
        visible={showBlockingModal && !blockingMinimized}
        attacks={gameState.attacks}
        myId={myId}
        myCourt={myState?.court ?? []}
        attackerCourt={
          attacksTargetingMe[0]
            ? (gameState.players[attacksTargetingMe[0].attackerPlayerId]?.court ?? [])
            : []
        }
        displayNames={displayNames}
        isSubmitting={isSubmitting}
        onConfirm={handleConfirmBlocks}
        onMinimize={() => setBlockingMinimized(true)}
      />

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

      {showDuelModal && effectiveDuelCtx && (
        <DuelPhaseModal
          visible={showDuelModal}
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
          isSubmitting={isSubmitting}
          autoPassMessage={autoPassMessage}
          remainingOpponentIds={gameState.duelQueue ?? []}
          onPass={handleDuelPass}
          onDismissAutoPass={handleDismissAutoPass}
        />
      )}

      {showBlockingModal && blockingMinimized && (
        <Pressable
          onPress={() => setBlockingMinimized(false)}
          style={({ pressed }) => [
            styles.blockingPill,
            pressed && { opacity: 0.8 },
          ]}
        >
          <Ionicons name="shield" size={15} color={Colors.accentRed} />
          <Text style={styles.blockingPillText}>Assign Blocks</Text>
          <Ionicons name="chevron-up" size={14} color={Colors.textMuted} />
        </Pressable>
      )}

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
        onCardPress={handleCardPress}
      />

      <View style={{ height: bottomInset }} />

      {(selectedCardId && (isMyTurn || isDefender || isClubResponder || isMyDuelTurn || isMyInterruptTurn || canInitiateInterrupt)) && (
        <CardActionSheet
          cardId={selectedCardId}
          phase={phase}
          isMyTurn={isMyTurn}
          isDefender={isDefender}
          isClubResponder={isClubResponder}
          isMyDuelTurn={!!isMyDuelTurn}
          isMyInterruptTurn={!!isMyInterruptTurn}
          canInitiateInterrupt={canInitiateInterrupt}
          myCourt={myState?.court ?? []}
          allPlayers={gameState.players}
          myPlayerId={myId}
          myVault={vault}
          isPending={isSubmitting}
          hasTakenDiamondAction={
            isMyDuelTurn && duelCtx
              ? (myId === duelCtx.attackerPlayerId ? !!duelCtx.attackerDiamondUsed : !!duelCtx.defenderDiamondUsed)
              : isClubResponder
                ? !!(pendingClub?.defenderDiamondUsed)
                : (gameState.myDiamondPlayed ?? false)
          }
          abyss={gameState.abyss}
          duelRoyalIdsByPlayer={isMyDuelTurn ? duelRoyalIdsByPlayer : undefined}
          onClose={() => setSelectedCardId(null)}
          onAction={handleAction}
        />
      )}
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
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    gap: 8,
    zIndex: 10,
    backgroundColor: "rgba(10,31,19,0.85)",
  },
  headerLeft: {
    flex: 1,
    alignItems: "flex-start",
    gap: 4,
  },
  headerCenter: {
    position: "absolute",
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
  },
  headerRight: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 8,
    alignItems: "center",
  },
  phaseTag: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  phaseTagClub: {
    backgroundColor: "rgba(200,155,60,0.15)",
    borderColor: "#C89B3C",
  },
  phaseTagDuel: {
    backgroundColor: "rgba(200,155,60,0.12)",
    borderColor: "#C89B3C",
  },
  phaseTagAttack: {
    backgroundColor: "rgba(200,16,46,0.18)",
    borderColor: Colors.accentRed,
  },
  phaseText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  phaseTextClub: {
    color: "#C89B3C",
  },
  phaseTextDuel: {
    color: "#C89B3C",
  },
  phaseTextAttack: {
    color: Colors.accentRed,
  },
  endGameBtn: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "rgba(200,16,46,0.35)",
    backgroundColor: "rgba(200,16,46,0.08)",
  },
  endGameBtnText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#C8102E",
    letterSpacing: 0.5,
  },
  turnText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  myTurnBadge: {
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 5,
  },
  myTurnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 1.5,
  },
  attackSelectBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Colors.accentRed,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  attackSelectBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 1.2,
  },
  duelTurnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C89B3C",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  duelTurnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 1.2,
  },
  interruptTurnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#5AB0FF",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  interruptTurnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 1.2,
  },
  interruptBanner: {
    marginHorizontal: 12,
    backgroundColor: "rgba(90,176,255,0.12)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#5AB0FF",
    padding: 14,
    gap: 10,
  },
  interruptHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  interruptTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#5AB0FF",
    flex: 1,
  },
  interruptStackList: {
    gap: 8,
  },
  interruptStackLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  interruptStackEntry: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderRadius: 10,
    padding: 8,
  },
  interruptStackIndex: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#5AB0FF",
    minWidth: 18,
    textAlign: "center",
  },
  interruptStackMeta: {
    flex: 1,
    gap: 2,
  },
  interruptStackPlayer: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  interruptStackAction: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textTransform: "capitalize",
  },
  interruptPassBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#5AB0FF",
    borderRadius: 10,
    paddingVertical: 10,
  },
  interruptPassText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  clubResponderBadge: {
    backgroundColor: "rgba(200,155,60,0.25)",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "#C89B3C",
  },
  clubResponderBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    letterSpacing: 1.2,
  },
  turnSub: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  vaultDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200,155,60,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.4)",
  },
  vaultIcon: {
    fontSize: 13,
  },
  vaultValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.brand,
  },
  lifeDisplay: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200,16,46,0.15)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: "rgba(200,16,46,0.4)",
  },
  lifeIcon: {
    fontSize: 13,
  },
  lifeValue: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
  },
  board: {
    flex: 1,
  },
  boardContent: {
    paddingVertical: 12,
    gap: 12,
  },
  opponentSection: {
    paddingHorizontal: 12,
    gap: 8,
  },
  myCourtSection: {
    paddingHorizontal: 12,
    gap: 8,
    backgroundColor: "rgba(26,56,36,0.3)",
    borderRadius: 12,
    marginHorizontal: 6,
    paddingVertical: 10,
  },
  sectionLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  actionRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    gap: 10,
  },
  attackBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  attackBtnDisabled: {
    opacity: 0.6,
  },
  attackBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  attackBtnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#FFF",
    letterSpacing: 0.5,
  },
  cancelSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cancelSelectText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  endTurnBtn: {
    flex: 1,
    borderRadius: 14,
    overflow: "hidden",
  },
  endTurnBtnGradient: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 16,
  },
  endTurnText: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 0.5,
  },
  waitingBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 12,
    backgroundColor: "rgba(10,31,19,0.5)",
    borderRadius: 12,
    marginHorizontal: 12,
  },
  waitingText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
  },
  discardBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(200,155,60,0.18)",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: "#C89B3C",
    marginHorizontal: 12,
  },
  discardBannerText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: "#C89B3C",
    flex: 1,
  },
  attackTargetBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(200,16,46,0.18)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1.5,
    borderColor: Colors.accentRed,
  },
  attackTargetText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
    flex: 1,
  },
  cancelAttackBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: Colors.bgSurface,
    borderRadius: 6,
  },
  cancelAttackText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  attackTargetHighlight: {
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.accentRed,
  },
  assignRoyalRow: {
    marginBottom: 4,
  },
  assignRoyalRowContent: {
    gap: 8,
    paddingHorizontal: 2,
  },
  assignRoyalChip: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1.5,
    borderColor: "transparent",
    minWidth: 88,
  },
  assignRoyalChipActive: {
    borderColor: Colors.accentRed,
    backgroundColor: "rgba(200,16,46,0.14)",
  },
  assignRoyalChipCard: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  assignRoyalChipValue: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  assignRoyalChipTarget: {
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
    marginTop: 2,
  },
  assignedRoyalsBadge: {
    position: "absolute",
    top: 6,
    right: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(200,16,46,0.85)",
    borderRadius: 8,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },
  assignedRoyalsBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#FFF",
  },
  combatResultBanner: {
    position: "absolute",
    top: 80,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(10,31,19,0.96)",
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderWidth: 1.5,
    borderColor: Colors.accentRed,
    zIndex: 200,
  },
  blockingPill: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginHorizontal: 16,
    marginBottom: 6,
    paddingVertical: 10,
    paddingHorizontal: 18,
    backgroundColor: "rgba(200,16,46,0.12)",
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.accentRed,
  },
  blockingPillText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
    flex: 1,
    textAlign: "center",
  },
  combatResultText: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  clubResponseBanner: {
    marginHorizontal: 12,
    backgroundColor: "rgba(200,155,60,0.12)",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#C89B3C",
    padding: 14,
    gap: 10,
  },
  clubResponseHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clubResponseTitle: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: "#C89B3C",
    flex: 1,
  },
  clubResponseDetails: {
    flexDirection: "row",
    gap: 16,
  },
  clubCardPreview: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  clubResponseLabel: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  clubResponseHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    fontStyle: "italic",
  },
  clubRoyalStats: {
    flexDirection: "column",
    gap: 3,
    justifyContent: "center",
  },
  clubStatPill: {
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
    backgroundColor: "rgba(0,0,0,0.2)",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  clubStatPillAtk: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  clubStatPillHp: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.accentGreen,
  },
  attackSelectBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(200,16,46,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(200,16,46,0.4)",
    marginHorizontal: 12,
  },
  attackSelectBannerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.accentRed,
    flex: 1,
  },
  damageOrderBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(200,155,60,0.12)",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: Colors.brand,
    marginHorizontal: 12,
  },
  damageOrderBannerText: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.brand,
    flex: 1,
  },
});
