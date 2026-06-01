import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeIn } from "react-native-reanimated";
import type { AttackDeclaration, DuelContext, RoyalInCourt } from "@workspace/api-client-react";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import Colors from "@/constants/colors";

interface DuelPhaseModalProps {
  visible: boolean;
  phase: string;
  attacks: AttackDeclaration[];
  duelContext: DuelContext;
  myId: string;
  attackerCourt: RoyalInCourt[];
  defenderCourt: RoyalInCourt[];
  displayNames: Record<string, string>;
  isSubmitting: boolean;
  autoPassMessage?: string | null;
  onPass: () => void;
  onDismissAutoPass?: () => void;
}

export default function DuelPhaseModal({
  visible,
  phase,
  attacks,
  duelContext,
  myId,
  attackerCourt,
  defenderCourt,
  displayNames,
  isSubmitting,
  autoPassMessage,
  onPass,
  onDismissAutoPass,
}: DuelPhaseModalProps) {
  const isMyDuelTurn =
    (phase === "duel_attacker_turn" && myId === duelContext.attackerPlayerId) ||
    (phase === "duel_blocker_turn" && myId === duelContext.defenderPlayerId);

  const isAttacker = myId === duelContext.attackerPlayerId;
  const myDiamondUsed = isAttacker ? duelContext.attackerDiamondUsed : duelContext.defenderDiamondUsed;

  const attackerName = displayNames[duelContext.attackerPlayerId] ?? duelContext.attackerPlayerId.slice(0, 8);
  const defenderName = displayNames[duelContext.defenderPlayerId] ?? duelContext.defenderPlayerId.slice(0, 8);

  if (!visible) return null;

  return (
    <View style={styles.panel}>
      <View style={styles.panelHeader}>
        <View style={styles.titleRow}>
          <Ionicons name="flash" size={15} color="#C89B3C" />
          <Text style={styles.title}>Duel in Progress</Text>
          {myDiamondUsed && (
            <View style={styles.diamondUsedChip}>
              <Text style={styles.diamondUsedText}>♦ Used</Text>
            </View>
          )}
        </View>

        {autoPassMessage ? (
          <Animated.View entering={FadeIn.duration(200)} style={styles.autoPassBanner}>
            <Ionicons name="alert-circle" size={14} color="#C89B3C" />
            <Text style={styles.autoPassText}>No cards left to play — Pass to resolve combat</Text>
          </Animated.View>
        ) : isMyDuelTurn ? (
          <Animated.View entering={FadeIn.duration(300)} style={styles.myTurnBadge}>
            <Ionicons name="flash" size={12} color={Colors.bgDeep} />
            <Text style={styles.myTurnText}>YOUR TURN — tap a card below or pass</Text>
          </Animated.View>
        ) : (
          <View style={styles.waitingBadge}>
            <ActivityIndicator size="small" color={Colors.textMuted} />
            <Text style={styles.waitingText}>Waiting for opponent...</Text>
          </View>
        )}
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.pairsRow}
        contentContainerStyle={styles.pairsContent}
      >
        {attacks.map((atk) => {
          const atkCard = parseCardId(atk.attackerCardId);
          const blockerIds = atk.blockerCardIds ?? [];
          const atkRoyal = attackerCourt.find((r) => r.cardId === atk.attackerCardId);
          const atkAtk = atkRoyal ? effectiveAttack(atkRoyal.cardId, atkRoyal.buffAttack) : null;
          const atkHp = atkRoyal
            ? effectiveHealth(atkRoyal.cardId, atkRoyal.buffHealth, atkRoyal.damageTaken)
            : null;

          return (
            <View key={atk.attackerCardId} style={styles.pairChip}>
              <View style={styles.pairSide}>
                <Text style={styles.pairName}>{attackerName}</Text>
                <Text style={[styles.pairCard, { color: atkCard.suitColor }]}>
                  {atkCard.displayRank}{atkCard.suitSymbol}
                </Text>
                {atkAtk !== null && atkHp !== null && (
                  <View style={styles.statsRow}>
                    <Text style={styles.statAtk}>⚔{atkAtk}</Text>
                    <Text style={styles.statHp}>♥{atkHp}</Text>
                  </View>
                )}
              </View>
              <View style={styles.vsCircle}>
                <Text style={styles.vsText}>VS</Text>
              </View>
              <View style={styles.pairSide}>
                {blockerIds.length > 0 ? (
                  <>
                    <Text style={styles.pairName}>{defenderName}</Text>
                    {blockerIds.map((blkId) => {
                      const blkCard = parseCardId(blkId);
                      const blkRoyal = defenderCourt.find((r) => r.cardId === blkId);
                      const blkAtk = blkRoyal ? effectiveAttack(blkRoyal.cardId, blkRoyal.buffAttack) : null;
                      const blkHp = blkRoyal
                        ? effectiveHealth(blkRoyal.cardId, blkRoyal.buffHealth, blkRoyal.damageTaken)
                        : null;
                      return (
                        <View key={blkId} style={styles.blockerEntry}>
                          <Text style={[styles.pairCard, { color: blkCard.suitColor }]}>
                            {blkCard.displayRank}{blkCard.suitSymbol}
                          </Text>
                          {blkAtk !== null && blkHp !== null && (
                            <View style={styles.statsRow}>
                              <Text style={styles.statAtk}>⚔{blkAtk}</Text>
                              <Text style={styles.statHp}>♥{blkHp}</Text>
                            </View>
                          )}
                        </View>
                      );
                    })}
                  </>
                ) : (
                  <Text style={styles.unblockedTag}>UNBLOCKED</Text>
                )}
              </View>
            </View>
          );
        })}
      </ScrollView>

      {(isMyDuelTurn || autoPassMessage) && (
        <View style={styles.footer}>
          <Pressable
            onPress={autoPassMessage ? onDismissAutoPass : onPass}
            disabled={isSubmitting}
            style={({ pressed }) => [
              styles.passBtn,
              pressed && { opacity: 0.8 },
            ]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.textMuted} />
            ) : (
              <>
                <Ionicons name="arrow-forward-circle" size={16} color={Colors.textMuted} />
                <Text style={styles.passBtnText}>Pass</Text>
              </>
            )}
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: "#C89B3C",
    paddingTop: 10,
    paddingBottom: 8,
    paddingHorizontal: 14,
    gap: 8,
  },
  panelHeader: {
    gap: 6,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    flex: 1,
  },
  diamondUsedChip: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    paddingVertical: 2,
    paddingHorizontal: 7,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  diamondUsedText: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  myTurnBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#C89B3C",
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  myTurnText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
    letterSpacing: 0.5,
  },
  waitingBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  waitingText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  pairsRow: {
    flexGrow: 0,
  },
  pairsContent: {
    gap: 8,
    paddingVertical: 2,
  },
  pairChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgSurface,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  pairSide: {
    alignItems: "center",
    minWidth: 54,
    gap: 2,
  },
  pairName: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  pairCard: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
  },
  statsRow: {
    flexDirection: "row",
    gap: 5,
  },
  statAtk: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: "#C89B3C",
  },
  statHp: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentRed,
  },
  blockerEntry: {
    alignItems: "center",
    gap: 2,
  },
  unblockedTag: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
    letterSpacing: 0.5,
  },
  vsCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: Colors.bgDeep,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#C89B3C",
  },
  vsText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
  },
  passBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  passBtnText: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  autoPassBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    backgroundColor: Colors.bgSurface,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: "#C89B3C",
  },
  autoPassText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    flex: 1,
  },
  autoPassBtn: {
    backgroundColor: "#C89B3C",
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 12,
  },
  autoPassBtnText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
});
