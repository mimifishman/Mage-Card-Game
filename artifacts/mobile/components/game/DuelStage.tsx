import React, { useEffect } from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  FadeInDown,
  FadeOut,
  SlideInLeft,
  SlideInRight,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import type { AttackDeclaration, DuelContext, RoyalInCourt } from "@workspace/api-client-react";
import { effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { Tints, Type } from "@/constants/theme";
import { useReduceMotion } from "@/lib/motion";

interface DuelStageProps {
  phase: string;
  attacks: AttackDeclaration[];
  duelContext: DuelContext;
  myId: string;
  attackerCourt: RoyalInCourt[];
  defenderCourt: RoyalInCourt[];
  displayNames: Record<string, string>;
  attackerColor: string;
  defenderColor: string;
  isSubmitting: boolean;
  /** Duels already resolved this combat — shown as ✓ rows so the whole
      sequence stays visible. */
  completedDuels?: { id: number; text: string }[];
  /** Duels still queued after this one — shown as ⏳ rows. */
  upcomingDuels?: { name: string; color: string; fights: number }[];
  /** When a Royal-targeting spell is selected, the fighting cards become
      tappable targets so you can buff/debuff right here in the duel window. */
  targetingRoyals?: boolean;
  targetGlowColor?: string;
  onRoyalTarget?: (ownerPlayerId: string, royalCardId: string) => void;
  onPass: () => void;
}

/** Center-stage duel, built for glanceability:
    - every live fight is a row (attacker VS blockers) — no sideways hunting
    - fights whose attacker or blockers have died disappear immediately
    - the header names both duelists in their colors and says whose move it is
    - spectators get a clearly-labeled watching state with NO buttons; only
      the duelist whose move it is ever sees Pass. */
export default function DuelStage({
  phase,
  attacks,
  duelContext,
  myId,
  attackerCourt,
  defenderCourt,
  displayNames,
  attackerColor,
  defenderColor,
  isSubmitting,
  completedDuels = [],
  upcomingDuels = [],
  targetingRoyals = false,
  targetGlowColor,
  onRoyalTarget,
  onPass,
}: DuelStageProps) {
  const targetable = targetingRoyals && !!onRoyalTarget;
  const reduceMotion = useReduceMotion();

  // A duel fighter card. The card ALWAYS keeps its owner's colour (identity),
  // so tappability is shown by a neutral gold dashed ring + 🎯 badge rather
  // than recolouring the card (which would falsely change who owns it).
  const FighterCard = ({ cardId, ownerId, baseGlow }: { cardId: string; ownerId: string; baseGlow: string }) => {
    if (targetable) {
      return (
        <Pressable
          onPress={() => onRoyalTarget!(ownerId, cardId)}
          style={({ pressed }) => [styles.targetRing, pressed && { opacity: 0.7 }]}
        >
          <CardView cardId={cardId} size="sm" glowColor={baseGlow} />
          <View style={styles.targetBadge}>
            <Text style={styles.targetBadgeText}>🎯</Text>
          </View>
        </Pressable>
      );
    }
    return <CardView cardId={cardId} size="sm" glowColor={baseGlow} />;
  };
  const isMyDuelTurn =
    (phase === "duel_attacker_turn" && myId === duelContext.attackerPlayerId) ||
    (phase === "duel_blocker_turn" && myId === duelContext.defenderPlayerId);
  const isAttacker = myId === duelContext.attackerPlayerId;
  const isParticipant = isAttacker || myId === duelContext.defenderPlayerId;
  const myDiamondUsed = isAttacker ? duelContext.attackerDiamondUsed : duelContext.defenderDiamondUsed;

  const nameFor = (id: string) => (id === myId ? "You" : (displayNames[id] ?? id.slice(0, 8)));
  const attackerName = nameFor(duelContext.attackerPlayerId);
  const defenderName = nameFor(duelContext.defenderPlayerId);
  const turnHolderId =
    phase === "duel_attacker_turn" ? duelContext.attackerPlayerId : duelContext.defenderPlayerId;
  const turnHolderName = nameFor(turnHolderId);
  const turnHolderColor = turnHolderId === duelContext.attackerPlayerId ? attackerColor : defenderColor;

  const attackerRoyal = (id: string) => attackerCourt.find((r) => r.cardId === id);
  const defenderRoyal = (id: string) => defenderCourt.find((r) => r.cardId === id);

  // Only fights that are still live: attacker Royal alive AND at least one
  // of its blockers alive. Decided fights vanish from the stage.
  const livePairs = attacks
    .map((atk) => ({
      atk,
      atkRoyal: attackerRoyal(atk.attackerCardId),
      liveBlockers: (atk.blockerCardIds ?? []).filter((b) => !!defenderRoyal(b)),
    }))
    .filter((p) => !!p.atkRoyal && p.liveBlockers.length > 0);

  return (
    <Animated.View
      entering={FadeInDown.duration(250)}
      exiting={FadeOut.duration(200)}
      style={styles.stage}
    >
      {/* Who is dueling, and whose move it is */}
      <View style={styles.header}>
        <Ionicons name="flash" size={15} color={Colors.brand} />
        <Text style={styles.title}>
          DUEL: <Text style={{ color: attackerColor }}>{attackerName}</Text>
          <Text style={styles.vsInline}>  vs  </Text>
          <Text style={{ color: defenderColor }}>{defenderName}</Text>
        </Text>
        {isParticipant && myDiamondUsed && (
          <View style={styles.diamondUsedChip}>
            <Text style={styles.diamondUsedText}>♦ used</Text>
          </View>
        )}
      </View>
      <View style={styles.turnRow}>
        <View style={[styles.turnDot, { backgroundColor: turnHolderColor }]} />
        <Text style={[styles.turnText, { color: turnHolderColor }]}>
          {isMyDuelTurn ? "Your move" : `${turnHolderName} to act`}
        </Text>
      </View>

      {targetable && (
        <View style={styles.targetHintRow}>
          <Ionicons name="locate" size={13} color={Colors.brand} />
          <Text style={[styles.targetHintText, { color: Colors.brand }]}>
            Tap a 🎯 Royal to target it
          </Text>
        </View>
      )}

      {/* Duels already fought this combat */}
      {completedDuels.map((d) => (
        <View key={d.id} style={styles.doneRow}>
          <Text style={styles.doneCheck}>✓</Text>
          <Text style={styles.doneText} numberOfLines={2}>{d.text}</Text>
        </View>
      ))}

      {/* Every live fight, one row each */}
      <View style={styles.pairList}>
        {livePairs.length === 0 ? (
          <View style={styles.resolvingRow}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.resolvingText}>Resolving…</Text>
          </View>
        ) : (
          livePairs.map(({ atk, atkRoyal, liveBlockers }) => (
            <View key={atk.attackerCardId} style={styles.pairRow}>
              {/* The clash: fighters slam in from opposite sides, the VS
                  seal stamps down with a flash between them. */}
              <Animated.View
                entering={reduceMotion ? undefined : SlideInLeft.springify().damping(15)}
                style={styles.fighter}
              >
                <FighterCard cardId={atk.attackerCardId} ownerId={duelContext.attackerPlayerId} baseGlow={attackerColor} />
                <Text style={styles.fighterStats}>
                  <Text style={styles.statAtk}>⚔{effectiveAttack(atk.attackerCardId, atkRoyal!.buffAttack)}</Text>
                  {"  "}
                  <Text style={styles.statHp}>
                    ♥{effectiveHealth(atk.attackerCardId, atkRoyal!.buffHealth, atkRoyal!.damageTaken)}
                  </Text>
                </Text>
              </Animated.View>

              <Animated.View
                entering={reduceMotion ? undefined : ZoomIn.delay(180).springify().damping(12)}
                style={styles.vsBadge}
              >
                {!reduceMotion && <ClashFlash />}
                <Text style={styles.vsText}>VS</Text>
              </Animated.View>

              <Animated.View
                entering={reduceMotion ? undefined : SlideInRight.springify().damping(15)}
                style={styles.blockerGroup}
              >
                {liveBlockers.map((blkId) => {
                  const blk = defenderRoyal(blkId)!;
                  return (
                    <View key={blkId} style={styles.fighter}>
                      <FighterCard cardId={blkId} ownerId={duelContext.defenderPlayerId} baseGlow={defenderColor} />
                      <Text style={styles.fighterStats}>
                        <Text style={styles.statAtk}>⚔{effectiveAttack(blkId, blk.buffAttack)}</Text>
                        {"  "}
                        <Text style={styles.statHp}>
                          ♥{effectiveHealth(blkId, blk.buffHealth, blk.damageTaken)}
                        </Text>
                      </Text>
                    </View>
                  );
                })}
              </Animated.View>
            </View>
          ))
        )}
      </View>

      {/* Duels still to come after this one */}
      {upcomingDuels.map((u, i) => (
        <View key={`${u.name}-${i}`} style={styles.upcomingRow}>
          <Text style={styles.upcomingHourglass}>⏳</Text>
          <Text style={styles.upcomingText}>
            then <Text style={{ color: attackerColor }}>{attackerName}</Text> duels{" "}
            <Text style={{ color: u.color }}>{u.name}</Text>
            {u.fights > 0 ? ` — ${u.fights} fight${u.fights > 1 ? "s" : ""} waiting` : ""}
          </Text>
        </View>
      ))}

      {/* Footer: only the duelist whose move it is gets a button */}
      {isMyDuelTurn ? (
        <View style={styles.footerRow}>
          <Text style={styles.yourMoveText}>Play a card from your hand — or pass</Text>
          <Pressable
            onPress={onPass}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.8 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.bgDeep} />
            ) : (
              <Text style={styles.passBtnText}>Pass</Text>
            )}
          </Pressable>
        </View>
      ) : isParticipant ? (
        <View style={styles.footerRow}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Text style={styles.waitingText}>Waiting for {turnHolderName}…</Text>
        </View>
      ) : (
        <View style={styles.footerRow}>
          <Ionicons name="eye" size={13} color={Colors.textMuted} />
          <Text style={styles.waitingText}>
            You're not in this duel — nothing for you to do
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

/** One-shot gold shockwave behind the VS seal when a fight row appears. */
function ClashFlash() {
  const scale = useSharedValue(0.3);
  const opacity = useSharedValue(0);
  useEffect(() => {
    scale.value = withDelay(220, withTiming(2.1, { duration: 340 }));
    opacity.value = withDelay(
      220,
      withSequence(withTiming(0.8, { duration: 70 }), withTiming(0, { duration: 270 })),
    );
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.clashFlash, style]} />;
}

const styles = StyleSheet.create({
  clashFlash: {
    position: "absolute",
    top: 0,
    left: 0,
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#FFF3D6",
  },
  stage: {
    marginHorizontal: 8,
    backgroundColor: Tints.obsidianPanel,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.brand,
    padding: 10,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    flex: 1,
    fontSize: 14,
    ...Type.heading,
    color: Colors.brand,
    letterSpacing: 0.5,
  },
  vsInline: {
    fontSize: 11,
    color: Colors.textMuted,
  },
  diamondUsedChip: {
    backgroundColor: Tints.azure,
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diamondUsedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.suitFx.D.accent,
  },
  turnRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  turnDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  turnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  doneRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: Tints.greenFaint,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  doneCheck: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.suitFx.C.accent,
  },
  doneText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_500Medium",
    color: Colors.textSecondary,
  },
  upcomingRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  upcomingHourglass: {
    fontSize: 11,
  },
  upcomingText: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  pairList: {
    gap: 8,
  },
  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Tints.whiteFaint,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  resolvingRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 8,
  },
  resolvingText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  fighter: {
    alignItems: "center",
    gap: 2,
  },
  targetRing: {
    borderWidth: 2,
    borderColor: Colors.brand,
    borderStyle: "dashed",
    borderRadius: 10,
    padding: 2,
  },
  targetBadge: {
    position: "absolute",
    top: -7,
    right: -7,
    backgroundColor: Colors.brand,
    borderRadius: 9,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  targetBadgeText: {
    fontSize: 10,
  },
  targetHintRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  targetHintText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  fighterStats: {
    fontSize: 12,
  },
  statAtk: {
    fontFamily: "Inter_700Bold",
    color: Colors.brand,
  },
  statHp: {
    fontFamily: "Inter_700Bold",
    color: Colors.suitFx.C.accent,
  },
  vsBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.brand,
    alignItems: "center",
    justifyContent: "center",
  },
  vsText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  blockerGroup: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
    flex: 1,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  yourMoveText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  waitingText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  passBtn: {
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  passBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
});
