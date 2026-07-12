import React from "react";
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown, FadeOut } from "react-native-reanimated";
import type { AttackDeclaration, DuelContext, RoyalInCourt } from "@workspace/api-client-react";
import { effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
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
  remainingOpponentIds?: string[];
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
  remainingOpponentIds = [],
  onPass,
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
        <Ionicons name="flash" size={15} color="#C89B3C" />
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
        {remainingOpponentIds.length > 0 && (
          <Text style={styles.queueText}>
            · then {attackerName} duels {remainingOpponentIds.map((id) => nameFor(id)).join(", ")}
          </Text>
        )}
      </View>

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
              <View style={styles.fighter}>
                <CardView cardId={atk.attackerCardId} size="sm" glowColor={attackerColor} />
                <Text style={styles.fighterStats}>
                  <Text style={styles.statAtk}>⚔{effectiveAttack(atk.attackerCardId, atkRoyal!.buffAttack)}</Text>
                  {"  "}
                  <Text style={styles.statHp}>
                    ♥{effectiveHealth(atk.attackerCardId, atkRoyal!.buffHealth, atkRoyal!.damageTaken)}
                  </Text>
                </Text>
              </View>

              <View style={styles.vsBadge}>
                <Text style={styles.vsText}>VS</Text>
              </View>

              <View style={styles.blockerGroup}>
                {liveBlockers.map((blkId) => {
                  const blk = defenderRoyal(blkId)!;
                  return (
                    <View key={blkId} style={styles.fighter}>
                      <CardView cardId={blkId} size="sm" glowColor={defenderColor} />
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
              </View>
            </View>
          ))
        )}
      </View>

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
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
    letterSpacing: 0.5,
  },
  vsInline: {
    fontSize: 11,
    color: Colors.textMuted,
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
  queueText: {
    fontSize: 10,
    fontFamily: "Inter_500Medium",
    color: Colors.textMuted,
  },
  pairList: {
    gap: 8,
  },
  pairRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.04)",
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
  fighterStats: {
    fontSize: 12,
  },
  statAtk: {
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  statHp: {
    fontFamily: "Inter_700Bold",
    color: "#66BB6A",
  },
  vsBadge: {
    width: 26,
    height: 26,
    borderRadius: 13,
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
