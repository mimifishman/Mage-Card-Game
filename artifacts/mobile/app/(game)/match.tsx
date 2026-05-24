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
import CardView from "@/components/game/CardView";
import { parseCardId, isDuelTurnPhase } from "@/lib/gameUtils";
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
  const [pendingAttackTargetId, setPendingAttackTargetId] = useState<string | null>(null);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [combatResultText, setCombatResultText] = useState<string | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevPlayersRef = useRef<Record<string, { life: number; courtSize: number }>>({});

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

  // Detect combat resolution: duel phase → main
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const prevPlayers = prevPlayersRef.current;

    const wasDuel = prev === "duel_attacker_turn" || prev === "duel_blocker_turn" || prev === "declare_blocks";
    const nowResolved = gameState.phase === "main" || gameState.phase === "draw";

    if (wasDuel && nowResolved) {
      const parts: string[] = [];
      for (const [id, p] of Object.entries(gameState.players)) {
        const before = prevPlayers[id];
        if (!before) continue;
        const lifeDelta = p.life - before.life;
        if (lifeDelta < 0) {
          const name = displayNames[id] ?? id.slice(0, 8);
          parts.push(`${name} took ${-lifeDelta} damage`);
        }
        const courtLost = before.courtSize - p.court.length;
        if (courtLost > 0) {
          const name = displayNames[id] ?? id.slice(0, 8);
          parts.push(`${name} lost ${courtLost} Royal${courtLost > 1 ? "s" : ""}`);
        }
      }
      if (parts.length > 0) {
        setCombatResultText(parts.join(" · "));
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
        setPendingAttackTargetId(null);
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

      if (
        gameState?.activePlayerId !== myId &&
        !actingAsDefender &&
        !actingAsClubResponder &&
        !actingAsDuelParticipant
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
          };
          break;
        case "attach_spade":
          body = {
            type: "attach_spade",
            spadeCardId: params.cardId,
            targetRoyalId: params.targetRoyalId!,
          };
          break;
        case "discard_heart_to_heal":
          body = {
            type: "discard_heart_to_heal",
            heartCardId: params.cardId,
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

  const handleAttack = useCallback((targetPlayerId: string) => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "declare_attack", targetPlayerId } });
    setPendingAttackTargetId(null);
  }, [matchId, submitAction]);

  const handleConfirmBlocks = useCallback((blocks: Record<string, string>) => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "confirm_declare_blocks", blocks } });
  }, [matchId, submitAction]);

  const handleDuelPass = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "duel_pass" } });
  }, [matchId, submitAction]);

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
  const inDuel = isDuelTurnPhase(phase);
  const attacksTargetingMe = gameState.attacks.filter((a) => a.targetPlayerId === myId);
  const isDefender = inDeclareBlocks && attacksTargetingMe.length > 0;

  const duelCtx = gameState.duelContext;
  const isMyDuelTurn = inDuel && duelCtx && (
    (phase === "duel_attacker_turn" && myId === duelCtx.attackerPlayerId) ||
    (phase === "duel_blocker_turn" && myId === duelCtx.defenderPlayerId)
  );
  const isInDuel = inDuel && duelCtx && (
    myId === duelCtx.attackerPlayerId || myId === duelCtx.defenderPlayerId
  );

  const pendingClub = gameState.pendingClubDebuff;
  const isClubResponder = inRespondToClub && pendingClub?.targetPlayerId === myId;
  const isClubAttacker = inRespondToClub && pendingClub?.attackerPlayerId === myId;

  const vault = myState?.vault.available ?? 0;

  const inDiscardPhase = isMyTurn && phase === "discard";
  const discardCount = inDiscardPhase ? Math.max(0, (gameState.myHand ?? []).length - 7) : 0;

  const canEndTurn = isMyTurn && (inMainPhase || phase === "end_turn") && !inDiscardPhase;

  const eligibleAttackers = (myState?.court ?? []).filter((r) => !r.hasAttackedThisTurn && !r.hasteLocked);
  const hasEligibleAttackers = eligibleAttackers.length > 0;

  const showAttackButton = isMyTurn && inMainPhase && hasEligibleAttackers && !gameState.hasAttackedThisTurn;

  const showBlockingModal = inDeclareBlocks && attacksTargetingMe.length > 0;

  const showDuelModal = inDuel && !!duelCtx;

  const activePlayerName = displayNames[gameState.activePlayerId]
    ?? (gameState.activePlayerId === myId ? (user?.displayName ?? "You") : gameState.activePlayerId.slice(0, 8));

  const clubAttackerName = pendingClub
    ? (displayNames[pendingClub.attackerPlayerId] ?? pendingClub.attackerPlayerId.slice(0, 8))
    : "";
  const clubDefenderName = pendingClub
    ? (displayNames[pendingClub.targetPlayerId] ?? pendingClub.targetPlayerId.slice(0, 8))
    : "";

  const handleCardPress = (cardId: string) => {
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const handleOwnRoyalPress = (royalId: string) => {
    const canPlay = (isMyTurn && inMainPhase) || (isDefender && inDeclareBlocks) || isClubResponder;
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
    if (!isMyTurn && !isDefender && !isClubResponder) return;
    if (!selectedCardId) return;
    const card = parseCardId(selectedCardId);

    if (card.suit === "C") {
      handleAction({ cardId: selectedCardId, action: "apply_club", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    } else if (card.isJoker && isMyTurn) {
      handleAction({ cardId: selectedCardId, action: "play_joker", mode: "destroy_royal", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    }
  };

  const handleAttackButtonPress = () => {
    const activeOpponents = opponents.filter((o) => !o.isEliminated);
    if (activeOpponents.length === 0) return;
    if (activeOpponents.length === 1) {
      handleAttack(activeOpponents[0]!.id);
    } else {
      setPendingAttackTargetId("__picking__");
    }
  };

  const handleOpponentPanelPress = (opponentId: string) => {
    if (!pendingAttackTargetId || !isMyTurn || !inMainPhase) return;
    handleAttack(opponentId);
  };

  const isPickingAttackTarget = pendingAttackTargetId === "__picking__";

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0D2B1A", "#0A1F13", "#0D2B1A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={[
            styles.phaseTag,
            inRespondToClub && styles.phaseTagClub,
            inDuel && styles.phaseTagDuel,
          ]}>
            <Text style={[
              styles.phaseText,
              inRespondToClub && styles.phaseTextClub,
              inDuel && styles.phaseTextDuel,
            ]}>
              {phase.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <Pressable
            onPress={handleAbandon}
            style={({ pressed }) => [styles.endGameBtn, pressed && { opacity: 0.7 }]}
          >
            <Text style={styles.endGameBtnText}>⚑ End Game</Text>
          </Pressable>
        </View>

        <View style={styles.headerCenter}>
          {isMyTurn && !inDuel ? (
            <View style={styles.myTurnBadge}>
              <Text style={styles.myTurnText}>YOUR TURN</Text>
            </View>
          ) : isMyDuelTurn ? (
            <View style={styles.duelTurnBadge}>
              <Ionicons name="flash" size={13} color={Colors.bgDeep} />
              <Text style={styles.duelTurnText}>DUEL — YOUR MOVE</Text>
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
                  Tap an opponent to attack with all your Royals
                </Text>
                <Pressable onPress={() => setPendingAttackTargetId(null)} style={styles.cancelAttackBtn}>
                  <Text style={styles.cancelAttackText}>Cancel</Text>
                </Pressable>
              </View>
            )}
            {opponents.map((opp) => (
              <Pressable
                key={opp.id}
                onPress={() => handleOpponentPanelPress(opp.id)}
                disabled={!isPickingAttackTarget || opp.isEliminated}
                style={({ pressed }) => [
                  isPickingAttackTarget && !opp.isEliminated && styles.attackTargetHighlight,
                  pressed && isPickingAttackTarget && !opp.isEliminated && { opacity: 0.75 },
                ]}
              >
                <OpponentPanel
                  player={opp}
                  displayName={displayNames[opp.id] ?? opp.id.slice(0, 8)}
                  isActive={gameState.activePlayerId === opp.id}
                  isEliminated={opp.isEliminated}
                  onRoyalPress={
                    ((isMyTurn && inMainPhase) || isClubResponder) && !opp.isEliminated && selectedCardId
                      ? (royalId) => handleOpponentRoyalPress(royalId, opp.id)
                      : undefined
                  }
                />
              </Pressable>
            ))}
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
                </View>
              </View>
            )}
            {isClubResponder && (
              <Text style={styles.clubResponseHint}>
                Play Hearts, Spades, or non-Royal Clubs to strengthen your Royal before the debuff lands. Diamonds may be discarded but not sent to the Mine.
              </Text>
            )}
          </Animated.View>
        )}

        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.myCourtSection}>
          <Text style={styles.sectionLabel}>YOUR COURT</Text>
          <CourtZone
            court={myState?.court ?? []}
            isMyZone
            isMyTurn={isMyTurn}
            size="xl"
            onRoyalPress={
              (isMyTurn && inMainPhase && selectedCardId)
                ? (royalId) => handleOwnRoyalPress(royalId)
                : (isDefender && selectedCardId)
                ? (royalId) => handleOwnRoyalPress(royalId)
                : (isClubResponder && selectedCardId)
                ? (royalId) => handleOwnRoyalPress(royalId)
                : undefined
            }
            selectedTargetId={selectedTargetRoyalId}
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

        {!isMyTurn && !inDeclareBlocks && !inRespondToClub && !inDuel && (
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
        visible={showBlockingModal}
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
      />

      {showDuelModal && duelCtx && (
        <DuelPhaseModal
          visible={showDuelModal}
          phase={phase}
          attacks={gameState.attacks}
          duelContext={duelCtx}
          myId={myId}
          attackerCourt={gameState.players[duelCtx.attackerPlayerId]?.court ?? []}
          defenderCourt={gameState.players[duelCtx.defenderPlayerId]?.court ?? []}
          displayNames={displayNames}
          isSubmitting={isSubmitting}
          onPass={handleDuelPass}
        />
      )}

      <HandTray
        cards={gameState.myHand}
        selectedCardId={selectedCardId}
        isMyTurn={isMyTurn}
        isDefender={isDefender}
        isClubResponder={isClubResponder}
        isMyDuelTurn={!!isMyDuelTurn}
        phase={phase}
        onCardPress={handleCardPress}
      />

      <View style={{ height: bottomInset }} />

      {(selectedCardId && (isMyTurn || isDefender || isClubResponder || isMyDuelTurn)) && (
        <CardActionSheet
          cardId={selectedCardId}
          phase={phase}
          isMyTurn={isMyTurn}
          isDefender={isDefender}
          isClubResponder={isClubResponder}
          isMyDuelTurn={!!isMyDuelTurn}
          myCourt={myState?.court ?? []}
          allPlayers={gameState.players}
          myPlayerId={myId}
          myVault={vault}
          isPending={isSubmitting}
          hasTakenDiamondAction={
            isMyDuelTurn && duelCtx
              ? (myId === duelCtx.attackerPlayerId ? !!duelCtx.attackerDiamondUsed : !!duelCtx.defenderDiamondUsed)
              : (gameState.myDiamondPlayed ?? false)
          }
          abyss={gameState.abyss}
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
    alignItems: "center",
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
    color: Colors.textMuted,
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
});
