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
import { parseCardId } from "@/lib/gameUtils";

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
  const [pendingAttackerRoyalId, setPendingAttackerRoyalId] = useState<string | null>(null);
  const [selectingAttacker, setSelectingAttacker] = useState(false);
  const [displayNames, setDisplayNames] = useState<Record<string, string>>({});
  const [blockingPassedIds, setBlockingPassedIds] = useState<Set<string>>(new Set());
  const [blockingDismissed, setBlockingDismissed] = useState(false);
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

  // Populate displayNames from match players metadata
  useEffect(() => {
    if (matchData?.players) {
      const names: Record<string, string> = {};
      for (const p of matchData.players) {
        names[p.userId] = p.displayName;
      }
      setDisplayNames(names);
    }
  }, [matchData]);

  // Detect game-over from polled match status (covers opponent-triggered endings)
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

  // Detect combat resolution: phase moved from declare_blocks → end_turn
  useEffect(() => {
    if (!gameState) return;
    const prev = prevPhaseRef.current;
    const prevPlayers = prevPlayersRef.current;

    if (prev === "declare_blocks" && (gameState.phase === "end_turn" || gameState.phase === "draw")) {
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

  // Reset blocking state when exiting declare_blocks phase
  useEffect(() => {
    if (!gameState) return;
    if (gameState.phase !== "declare_blocks") {
      setBlockingPassedIds(new Set());
      setBlockingDismissed(false);
    }
  }, [gameState?.phase]);

  const { mutate: submitAction, isPending: isSubmitting } = useSubmitGameAction({
    mutation: {
      onSuccess: (data) => {
        setGameState(data.state);
        setSelectedCardId(null);
        setSelectedTargetRoyalId(null);
        setPendingAttackerRoyalId(null);
        setSelectingAttacker(false);
        if (data.winnerUserId) {
          hasNavigatedRef.current = true;
          router.replace({
            pathname: "/(game)/game-over",
            params: { matchId, winnerUserId: data.winnerUserId },
          });
        }
      },
      onError: (err) => {
        const msg = (err as { data?: { error?: string } })?.data?.error ?? "Action failed";
        Alert.alert("Action rejected", msg);
      },
    },
  });

  const handleAction = useCallback(
    (params: ActionParams) => {
      if (!matchId) return;
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
    [matchId, submitAction],
  );

  const handleEndTurn = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "end_turn" } });
  }, [matchId, submitAction]);

  const handleBlock = useCallback(
    (blockerRoyalId: string, attackerRoyalId: string) => {
      if (!matchId) return;
      submitAction({ matchId, data: { type: "declare_block", blockerRoyalId, attackerRoyalId } });
    },
    [matchId, submitAction],
  );

  const handleResolveCombat = useCallback(() => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "resolve_combat" } });
  }, [matchId, submitAction]);

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
  const inDeclareAttacks = phase === "declare_attacks";
  const inDeclareBlocks = phase === "declare_blocks";
  const vault = myState?.vault.available ?? 0;

  const canEndTurn = isMyTurn && (inMainPhase || phase === "end_turn");

  // "Done Attacking" button: only valid in declare_attacks phase (after ≥1 attack declared)
  const canDoneAttacking = isMyTurn && inDeclareAttacks;

  // "Resolve Combat" button: active player resolves only when all attacks are decided
  const allAttacksDecided =
    gameState.attacks.length > 0 &&
    gameState.attacks.every((a) => !!a.blockerCardId || !!a.passed);
  const canResolveCombat = isMyTurn && inDeclareBlocks && allAttacksDecided;

  // Royal can attack in main OR declare_attacks phase
  const inAttackPhase = inMainPhase || inDeclareAttacks;

  // Eligible attackers: royals that haven't attacked yet and aren't haste-locked
  const eligibleAttackers = (myState?.court ?? []).filter((r) => !r.hasAttackedThisTurn && !r.hasteLocked);
  const hasEligibleAttackers = eligibleAttackers.length > 0;

  // "Attack!" button: visible in main phase when eligible royals exist
  const showAttackButton = isMyTurn && inMainPhase && hasEligibleAttackers;

  // Blocking modal: shown to defender in declare_blocks phase
  const attacksTargetingMe = gameState.attacks.filter((a) => a.targetPlayerId === myId);
  const showBlockingModal = inDeclareBlocks && !isMyTurn && attacksTargetingMe.length > 0 && !blockingDismissed;

  const handleCardPress = (cardId: string) => {
    if (selectedCardId === cardId) {
      setSelectedCardId(null);
    } else {
      setSelectedCardId(cardId);
    }
  };

  const handleOwnRoyalPress = (royalId: string) => {
    if (!isMyTurn || !inMainPhase) return;

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

  // When user taps an opponent royal — could be: Club targeting, Joker targeting, or attack target
  const handleOpponentRoyalPress = (royalId: string, targetPlayerId: string) => {
    if (!isMyTurn || !inMainPhase) return;

    // Attack mode: if a royal is pending as attacker, declare the attack at this opponent
    if (pendingAttackerRoyalId && inAttackPhase) {
      if (!matchId) return;
      submitAction({
        matchId,
        data: { type: "declare_attack", attackerRoyalId: pendingAttackerRoyalId, targetPlayerId },
      });
      setPendingAttackerRoyalId(null);
      return;
    }

    if (!selectedCardId) return;
    const card = parseCardId(selectedCardId);

    if (card.suit === "C") {
      // Club directly targets the royal — dispatch immediately
      handleAction({ cardId: selectedCardId, action: "apply_club", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    } else if (card.isJoker) {
      // Tapping an opponent royal with Joker selected = destroy_royal intent
      handleAction({ cardId: selectedCardId, action: "play_joker", mode: "destroy_royal", targetPlayerId, targetRoyalId: royalId });
      setSelectedCardId(null);
    }
  };

  // Tap own royal in attack phase → if multiple opponents, enter pending attacker mode; else auto-target
  const handleRoyalAttackPress = (royalId: string) => {
    if (!matchId || !isMyTurn || !inAttackPhase) return;
    const royal = myState?.court.find((r) => r.cardId === royalId);
    if (!royal || royal.hasAttackedThisTurn || royal.hasteLocked) return;
    const activeOpponents = opponents.filter((o) => !o.isEliminated);
    if (activeOpponents.length === 0) return;
    if (activeOpponents.length === 1) {
      // Single opponent — auto-target
      submitAction({
        matchId,
        data: { type: "declare_attack", attackerRoyalId: royalId, targetPlayerId: activeOpponents[0]!.id },
      });
    } else {
      // Multiple opponents — enter pending mode so user can tap an opponent panel
      setPendingAttackerRoyalId(royalId);
    }
  };

  // Handle opponent panel press (for attack target selection in multi-opponent games)
  const handleOpponentPanelPress = (opponentId: string) => {
    if (!pendingAttackerRoyalId || !matchId || !isMyTurn || !inAttackPhase) return;
    submitAction({
      matchId,
      data: { type: "declare_attack", attackerRoyalId: pendingAttackerRoyalId, targetPlayerId: opponentId },
    });
    setPendingAttackerRoyalId(null);
  };

  const handleDoneAttacking = () => {
    if (!matchId) return;
    submitAction({ matchId, data: { type: "begin_declare_blocks" } });
  };

  const activePlayerName = displayNames[gameState.activePlayerId]
    ?? (gameState.activePlayerId === myId ? (user?.displayName ?? "You") : gameState.activePlayerId.slice(0, 8));

  return (
    <View style={styles.container}>
      <LinearGradient colors={["#0D2B1A", "#0A1F13", "#0D2B1A"]} style={StyleSheet.absoluteFill} pointerEvents="none" />

      <View style={[styles.header, { paddingTop: topInset + 8 }]}>
        <View style={styles.headerLeft}>
          <View style={styles.phaseTag}>
            <Text style={styles.phaseText}>{phase.replace("_", " ").toUpperCase()}</Text>
          </View>
        </View>

        <View style={styles.headerCenter}>
          {isMyTurn ? (
            <View style={styles.myTurnBadge}>
              <Text style={styles.myTurnText}>YOUR TURN</Text>
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
            {pendingAttackerRoyalId && (
              <View style={styles.attackTargetBanner}>
                <Ionicons name="flash" size={14} color={Colors.accentRed} />
                <Text style={styles.attackTargetText}>
                  Tap an opponent to attack
                </Text>
                <Pressable onPress={() => setPendingAttackerRoyalId(null)} style={styles.cancelAttackBtn}>
                  <Text style={styles.cancelAttackText}>Cancel</Text>
                </Pressable>
              </View>
            )}
            {opponents.map((opp) => (
              <Pressable
                key={opp.id}
                onPress={() => handleOpponentPanelPress(opp.id)}
                disabled={!pendingAttackerRoyalId || opp.isEliminated}
                style={({ pressed }) => [
                  pendingAttackerRoyalId && !opp.isEliminated && styles.attackTargetHighlight,
                  pressed && pendingAttackerRoyalId && !opp.isEliminated && { opacity: 0.75 },
                ]}
              >
                <OpponentPanel
                  player={opp}
                  displayName={displayNames[opp.id] ?? opp.id.slice(0, 8)}
                  isActive={gameState.activePlayerId === opp.id}
                  isEliminated={opp.isEliminated}
                  onRoyalPress={
                    isMyTurn && inMainPhase && !opp.isEliminated && (selectedCardId || pendingAttackerRoyalId)
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

        <Animated.View entering={FadeIn.delay(100).duration(400)} style={styles.myCourtSection}>
          <Text style={styles.sectionLabel}>YOUR COURT</Text>
          {selectingAttacker && (
            <View style={styles.attackTargetBanner}>
              <Ionicons name="flash" size={14} color={Colors.accentRed} />
              <Text style={styles.attackTargetText}>Tap a Royal to attack with</Text>
              <Pressable onPress={() => setSelectingAttacker(false)} style={styles.cancelAttackBtn}>
                <Text style={styles.cancelAttackText}>Cancel</Text>
              </Pressable>
            </View>
          )}
          <CourtZone
            court={myState?.court ?? []}
            isMyZone
            isMyTurn={isMyTurn}
            size="lg"
            onRoyalPress={
              isMyTurn
                ? (royalId) => {
                    const royal = myState?.court.find((r) => r.cardId === royalId);
                    const canAttack = royal && !royal.hasAttackedThisTurn && !royal.hasteLocked;
                    if ((inAttackPhase || selectingAttacker) && canAttack) {
                      setSelectingAttacker(false);
                      handleRoyalAttackPress(royalId);
                    } else if (inMainPhase && selectedCardId) {
                      handleOwnRoyalPress(royalId);
                    }
                  }
                : undefined
            }
            selectedTargetId={selectedTargetRoyalId}
          />
        </Animated.View>

        {(canEndTurn || canDoneAttacking || showAttackButton || canResolveCombat) && (
          <Animated.View entering={FadeIn.delay(200).duration(400)} style={styles.actionRow}>
            {showAttackButton && !selectingAttacker && (
              <Pressable
                onPress={() => setSelectingAttacker(true)}
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
            {canDoneAttacking && (
              <Pressable
                onPress={handleDoneAttacking}
                style={({ pressed }) => [styles.attackBtn, pressed && { opacity: 0.8 }]}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={[Colors.accentRed, "#8B1A1A"]}
                  style={styles.attackBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="shield" size={18} color="#FFF" />
                  <Text style={styles.attackBtnText}>Done Attacking</Text>
                </LinearGradient>
              </Pressable>
            )}
            {canResolveCombat && (
              <Pressable
                onPress={handleResolveCombat}
                style={({ pressed }) => [styles.attackBtn, pressed && { opacity: 0.8 }]}
                disabled={isSubmitting}
              >
                <LinearGradient
                  colors={["#8B2020", Colors.accentRed]}
                  style={styles.attackBtnGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <Ionicons name="flash-outline" size={18} color="#FFF" />
                  <Text style={styles.attackBtnText}>Resolve Combat</Text>
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

        {!isMyTurn && !inDeclareBlocks && (
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
        displayNames={displayNames}
        passedIds={blockingPassedIds}
        isSubmitting={isSubmitting}
        onBlock={handleBlock}
        onPass={(attackerRoyalId) => {
          if (matchId) {
            submitAction(
              { matchId, data: { type: "pass_block", attackerRoyalId } },
              {
                onSuccess: (data) => {
                  setGameState(data.state);
                  setBlockingPassedIds((prev) => new Set([...prev, attackerRoyalId]));
                },
              },
            );
          }
        }}
        onDismiss={() => setBlockingDismissed(true)}
      />

      <HandTray
        cards={gameState.myHand}
        selectedCardId={selectedCardId}
        isMyTurn={isMyTurn}
        phase={phase}
        onCardPress={handleCardPress}
      />

      <View style={{ height: bottomInset }} />

      {selectedCardId && (
        <CardActionSheet
          cardId={selectedCardId}
          phase={phase}
          isMyTurn={isMyTurn}
          myCourt={myState?.court ?? []}
          allPlayers={gameState.players}
          myPlayerId={myId}
          myVault={vault}
          isPending={isSubmitting}
          hasTakenDiamondAction={gameState.myDiamondPlayed}
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
  phaseText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 1.2,
  },
  reconnectBadge: {
    backgroundColor: "rgba(229,57,53,0.2)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.accentRed,
  },
  reconnectText: {
    fontSize: 9,
    fontFamily: "Inter_500Medium",
    color: Colors.accentRed,
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
});
