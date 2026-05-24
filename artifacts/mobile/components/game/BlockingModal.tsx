import React, { useMemo, useState, useCallback } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import type { AttackDeclaration, RoyalInCourt } from "@workspace/api-client-react";
import { Ionicons } from "@expo/vector-icons";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import CardView from "./CardView";
import Colors from "@/constants/colors";

interface BlockingModalProps {
  visible: boolean;
  attacks: AttackDeclaration[];
  myId: string;
  myCourt: RoyalInCourt[];
  attackerCourt: RoyalInCourt[];
  displayNames: Record<string, string>;
  isSubmitting: boolean;
  onConfirm: (blocks: Record<string, string>) => void;
}

export default function BlockingModal({
  visible,
  attacks,
  myId,
  myCourt,
  attackerCourt,
  displayNames,
  isSubmitting,
  onConfirm,
}: BlockingModalProps) {
  const incomingAttacks = useMemo(
    () => attacks.filter((a) => a.targetPlayerId === myId),
    [attacks, myId],
  );

  const [blocks, setBlocks] = useState<Record<string, string>>({});

  const assignBlock = useCallback((attackerCardId: string, blockerCardId: string) => {
    setBlocks((prev) => {
      const updated = { ...prev };
      for (const [atkId, blkId] of Object.entries(updated)) {
        if (blkId === blockerCardId && atkId !== attackerCardId) {
          delete updated[atkId];
        }
      }
      if (updated[attackerCardId] === blockerCardId) {
        delete updated[attackerCardId];
      } else {
        updated[attackerCardId] = blockerCardId;
      }
      return updated;
    });
  }, []);

  const passAttack = useCallback((attackerCardId: string) => {
    setBlocks((prev) => {
      const updated = { ...prev };
      if (updated[attackerCardId] === "pass") {
        delete updated[attackerCardId];
      } else {
        for (const [atkId, blkId] of Object.entries(updated)) {
          if (blkId !== "pass" && atkId === attackerCardId) {
            delete updated[atkId];
          }
        }
        updated[attackerCardId] = "pass";
      }
      return updated;
    });
  }, []);

  const allAssigned = incomingAttacks.length > 0 &&
    incomingAttacks.every((a) => !!blocks[a.attackerCardId]);

  const blockerUsedFor = useCallback((blockerCardId: string): string | null => {
    for (const [atkId, blkId] of Object.entries(blocks)) {
      if (blkId === blockerCardId) return atkId;
    }
    return null;
  }, [blocks]);

  const handleConfirm = useCallback(() => {
    if (!allAssigned) return;
    onConfirm(blocks);
    setBlocks({});
  }, [allAssigned, blocks, onConfirm]);

  if (!visible || incomingAttacks.length === 0) return null;

  const attackerName = displayNames[incomingAttacks[0]!.attackerPlayerId] ??
    incomingAttacks[0]!.attackerPlayerId.slice(0, 8);

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <View style={styles.titleRow}>
              <Ionicons name="flash" size={18} color={Colors.accentRed} />
              <Text style={styles.title}>Incoming Attack!</Text>
            </View>
            <Text style={styles.attackDesc}>
              <Text style={styles.attackerName}>{attackerName}</Text>
              {" sends "}<Text style={styles.attackCount}>{incomingAttacks.length}</Text>
              {" Royal"}{incomingAttacks.length !== 1 ? "s" : ""}{" — assign blocks"}
            </Text>
          </View>

          <ScrollView
            style={styles.attackList}
            contentContainerStyle={styles.attackListContent}
            showsVerticalScrollIndicator={false}
          >
            {incomingAttacks.map((atk) => {
              const atkCard = parseCardId(atk.attackerCardId);
              const assigned = blocks[atk.attackerCardId];
              const isPassed = assigned === "pass";
              const isBlocked = !!assigned && !isPassed;
              const atkRoyal = attackerCourt.find((r) => r.cardId === atk.attackerCardId);
              const atkAtk = atkRoyal ? effectiveAttack(atk.attackerCardId, atkRoyal.buffAttack) : null;
              const atkHp = atkRoyal ? effectiveHealth(atk.attackerCardId, atkRoyal.buffHealth, atkRoyal.damageTaken) : null;

              return (
                <View key={atk.attackerCardId} style={[
                  styles.attackRow,
                  isPassed && styles.attackRowPassed,
                  isBlocked && styles.attackRowBlocked,
                ]}>
                  <View style={styles.attackerSide}>
                    <CardView cardId={atk.attackerCardId} size="sm" />
                    <View style={styles.atkInfo}>
                      <Text style={[styles.atkRank, { color: atkCard.suitColor }]}>
                        {atkCard.displayRank}{atkCard.suitSymbol}
                      </Text>
                      {atkAtk !== null && atkHp !== null && (
                        <View style={styles.statRow}>
                          <View style={[styles.statChip, styles.statChipAtk]}>
                            <Text style={styles.statChipLabel}>⚔</Text>
                            <Text style={styles.statChipValue}>{atkAtk}</Text>
                          </View>
                          <View style={[styles.statChip, styles.statChipHp]}>
                            <Text style={styles.statChipLabel}>♥</Text>
                            <Text style={styles.statChipValue}>{atkHp}</Text>
                          </View>
                        </View>
                      )}
                      {isPassed && <Text style={styles.passedTag}>PASSING</Text>}
                      {isBlocked && (
                        <Text style={styles.blockedTag}>
                          ← {parseCardId(assigned).displayRank}{parseCardId(assigned).suitSymbol}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.attackControls}>
                    {myCourt.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blockerRow}>
                        {myCourt.map((royal) => {
                          const card = parseCardId(royal.cardId);
                          const usedFor = blockerUsedFor(royal.cardId);
                          const isAssignedHere = usedFor === atk.attackerCardId;
                          const isUsedElsewhere = !!usedFor && usedFor !== atk.attackerCardId;
                          const atk2 = effectiveAttack(royal.cardId, royal.buffAttack);
                          const hp = effectiveHealth(royal.cardId, royal.buffHealth, royal.damageTaken);

                          return (
                            <Pressable
                              key={royal.cardId}
                              onPress={() => !isUsedElsewhere && assignBlock(atk.attackerCardId, royal.cardId)}
                              disabled={isUsedElsewhere}
                              style={({ pressed }) => [
                                styles.blockerChip,
                                isAssignedHere && styles.blockerChipSelected,
                                isUsedElsewhere && styles.blockerChipUsed,
                                pressed && !isUsedElsewhere && { opacity: 0.75 },
                              ]}
                            >
                              <Text style={[styles.blockerChipText, { color: isAssignedHere ? Colors.bgDeep : card.suitColor }]}>
                                {card.displayRank}{card.suitSymbol}
                              </Text>
                              <Text style={[styles.blockerChipStats, { color: isAssignedHere ? Colors.bgDeep : Colors.textMuted }]}>
                                {atk2}/{hp}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                    <Pressable
                      onPress={() => passAttack(atk.attackerCardId)}
                      style={({ pressed }) => [
                        styles.passChip,
                        isPassed && styles.passChipSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.passChipText, isPassed && styles.passChipTextSelected]}>
                        Pass
                      </Text>
                    </Pressable>
                  </View>
                </View>
              );
            })}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.progressRow}>
              {incomingAttacks.map((a) => {
                const assigned = blocks[a.attackerCardId];
                return (
                  <View
                    key={a.attackerCardId}
                    style={[
                      styles.progressDot,
                      assigned === "pass" ? styles.dotPassed :
                      assigned ? styles.dotBlocked :
                      styles.dotPending,
                    ]}
                  />
                );
              })}
            </View>
            <Pressable
              onPress={handleConfirm}
              disabled={!allAssigned || isSubmitting}
              style={({ pressed }) => [
                styles.confirmBtn,
                (!allAssigned || isSubmitting) && styles.confirmBtnDisabled,
                pressed && allAssigned && { opacity: 0.8 },
              ]}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={Colors.bgDeep} />
              ) : (
                <>
                  <Ionicons name="shield-checkmark" size={18} color={allAssigned ? Colors.bgDeep : Colors.textMuted} />
                  <Text style={[styles.confirmText, !allAssigned && styles.confirmTextDisabled]}>
                    {allAssigned ? "Confirm Blocks" : `Assign all ${incomingAttacks.length} attack${incomingAttacks.length !== 1 ? "s" : ""}`}
                  </Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: Colors.bgCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderColor: Colors.accentRed,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 14,
    maxHeight: "80%",
  },
  header: {
    gap: 6,
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  attackDesc: {
    fontSize: 13,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  attackerName: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  attackCount: {
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
  },
  attackList: {
    maxHeight: 340,
  },
  attackListContent: {
    gap: 10,
  },
  attackRow: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    padding: 12,
    gap: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attackRowPassed: {
    borderColor: Colors.accentRed,
    backgroundColor: "rgba(200,16,46,0.06)",
  },
  attackRowBlocked: {
    borderColor: Colors.accentGreen,
    backgroundColor: "rgba(39,174,96,0.06)",
  },
  attackerSide: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  atkInfo: {
    gap: 2,
  },
  atkRank: {
    fontSize: 17,
    fontFamily: "Inter_700Bold",
  },
  statRow: {
    flexDirection: "row",
    gap: 5,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    borderRadius: 6,
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderWidth: 1,
  },
  statChipAtk: {
    backgroundColor: "rgba(201,155,60,0.15)",
    borderColor: "rgba(201,155,60,0.35)",
  },
  statChipHp: {
    backgroundColor: "rgba(239,83,80,0.12)",
    borderColor: "rgba(239,83,80,0.3)",
  },
  statChipLabel: {
    fontSize: 9,
    color: Colors.textSecondary,
  },
  statChipValue: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  passedTag: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
    letterSpacing: 1,
  },
  blockedTag: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentGreen,
  },
  attackControls: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  blockerRow: {
    flexShrink: 1,
  },
  blockerChip: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
    marginRight: 6,
    minWidth: 44,
  },
  blockerChipSelected: {
    backgroundColor: Colors.accentGreen,
    borderColor: Colors.accentGreen,
  },
  blockerChipUsed: {
    opacity: 0.35,
  },
  blockerChipText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  blockerChipStats: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  passChip: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: Colors.border,
    backgroundColor: Colors.bgDeep,
  },
  passChipSelected: {
    borderColor: Colors.accentRed,
    backgroundColor: "rgba(200,16,46,0.15)",
  },
  passChipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  passChipTextSelected: {
    color: Colors.accentRed,
  },
  footer: {
    gap: 10,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  progressDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotBlocked: {
    backgroundColor: Colors.accentGreen,
  },
  dotPassed: {
    backgroundColor: Colors.accentRed,
  },
  dotPending: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.border,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.accentGreen,
    borderRadius: 14,
    paddingVertical: 16,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmText: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
  confirmTextDisabled: {
    color: Colors.textMuted,
  },
});
