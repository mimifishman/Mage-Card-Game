import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import type { AttackDeclaration, DuelContext, RoyalInCourt } from "@workspace/api-client-react";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import CardView from "./CardView";
import Colors from "@/constants/colors";

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
  autoPassMessage?: string | null;
  remainingOpponentIds?: string[];
  onPass: () => void;
  onDismissAutoPass?: () => void;
}

/** Center-stage duel: the fighting pair(s) rendered large in the middle of
    the table with live ⚔/♥ values that update as buffs/debuffs land. The
    hand below stays fully usable — playing a card visibly changes these
    numbers. Spectators see the same stage. */
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
  autoPassMessage,
  remainingOpponentIds = [],
  onPass,
  onDismissAutoPass,
}: DuelStageProps) {
  const isMyDuelTurn =
    (phase === "duel_attacker_turn" && myId === duelContext.attackerPlayerId) ||
    (phase === "duel_blocker_turn" && myId === duelContext.defenderPlayerId);
  const isAttacker = myId === duelContext.attackerPlayerId;
  const isParticipant = isAttacker || myId === duelContext.defenderPlayerId;
  const myDiamondUsed = isAttacker ? duelContext.attackerDiamondUsed : duelContext.defenderDiamondUsed;

  const nameFor = (id: string) => (id === myId ? "You" : (displayNames[id] ?? id.slice(0, 8)));
  const attackerName = nameFor(duelContext.attackerPlayerId);
  const defenderName = nameFor(duelContext.defenderPlayerId);
  const turnHolderName =
    phase === "duel_attacker_turn" ? attackerName : phase === "duel_blocker_turn" ? defenderName : "";

  const royalFor = (court: RoyalInCourt[], id: string) => court.find((r) => r.cardId === id);

  return (
    <Animated.View entering={FadeInDown.duration(250)} style={styles.stage}>
      <View style={styles.header}>
        <Ionicons name="flash" size={15} color="#C89B3C" />
        <Text style={styles.title}>
          DUEL — <Text style={{ color: attackerColor }}>{attackerName}</Text> vs{" "}
          <Text style={{ color: defenderColor }}>{defenderName}</Text>
        </Text>
        {isParticipant && myDiamondUsed && (
          <View style={styles.diamondUsedChip}>
            <Text style={styles.diamondUsedText}>♦ used</Text>
          </View>
        )}
      </View>

      {remainingOpponentIds.length > 0 && (
        <Text style={styles.queueText}>
          Next duels: {remainingOpponentIds.map((id) => nameFor(id)).join(" → ")}
        </Text>
      )}

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.pairsRow}
      >
        {attacks.map((atk) => {
          const blockerIds = atk.blockerCardIds ?? [];
          const atkRoyal = royalFor(attackerCourt, atk.attackerCardId);
          return (
            <View key={atk.attackerCardId} style={styles.pair}>
              <View style={styles.fighter}>
                <CardView cardId={atk.attackerCardId} size="md" glowColor={attackerColor} />
                {atkRoyal && (
                  <View style={styles.fighterStats}>
                    <Text style={styles.statAtk}>⚔{effectiveAttack(atk.attackerCardId, atkRoyal.buffAttack)}</Text>
                    <Text style={styles.statHp}>
                      ♥{effectiveHealth(atk.attackerCardId, atkRoyal.buffHealth, atkRoyal.damageTaken)}
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.vsBadge}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              <View style={styles.blockerGroup}>
                {blockerIds.length === 0 ? (
                  <Text style={styles.unblocked}>UNBLOCKED</Text>
                ) : (
                  blockerIds.map((blkId) => {
                    const blkRoyal = royalFor(defenderCourt, blkId);
                    return (
                      <View key={blkId} style={styles.fighter}>
                        <CardView cardId={blkId} size="md" glowColor={defenderColor} />
                        {blkRoyal && (
                          <View style={styles.fighterStats}>
                            <Text style={styles.statAtk}>⚔{effectiveAttack(blkId, blkRoyal.buffAttack)}</Text>
                            <Text style={styles.statHp}>
                              ♥{effectiveHealth(blkId, blkRoyal.buffHealth, blkRoyal.damageTaken)}
                            </Text>
                          </View>
                        )}
                      </View>
                    );
                  })
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {autoPassMessage ? (
        <Animated.View entering={FadeIn.duration(200)} style={styles.footerRow}>
          <Text style={styles.autoPassText}>{autoPassMessage}</Text>
          <Pressable
            onPress={onDismissAutoPass}
            style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.8 }]}
          >
            <Text style={styles.passBtnText}>OK</Text>
          </Pressable>
        </Animated.View>
      ) : isMyDuelTurn ? (
        <View style={styles.footerRow}>
          <Text style={styles.yourMoveText}>Your move — play a card from your hand, or pass</Text>
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
      ) : (
        <View style={styles.footerRow}>
          <ActivityIndicator size="small" color={Colors.textMuted} />
          <Text style={styles.waitingText}>Waiting for {turnHolderName || "opponent"}…</Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  stage: {
    marginHorizontal: 8,
    backgroundColor: "rgba(10,20,14,0.92)",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "#C89B3C",
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
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    letterSpacing: 0.5,
  },
  diamondUsedChip: {
    backgroundColor: "rgba(21,101,192,0.25)",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  diamondUsedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: "#7EB6FF",
  },
  queueText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  pairsRow: {
    gap: 16,
    paddingVertical: 2,
    alignItems: "center",
  },
  pair: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  fighter: {
    alignItems: "center",
    gap: 3,
  },
  fighterStats: {
    flexDirection: "row",
    gap: 6,
  },
  statAtk: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  statHp: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#66BB6A",
  },
  vsBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#C89B3C",
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
    gap: 6,
  },
  unblocked: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
    letterSpacing: 1,
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
  autoPassText: {
    flex: 1,
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: "#C89B3C",
  },
  waitingText: {
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
