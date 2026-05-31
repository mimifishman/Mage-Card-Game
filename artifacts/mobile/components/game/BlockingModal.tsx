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
  onConfirm: (blocks: Record<string, string[]>) => void;
  onMinimize?: () => void;
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
  onMinimize,
}: BlockingModalProps) {
  const incomingAttacks = useMemo(
    () => attacks.filter((a) => a.targetPlayerId === myId),
    [attacks, myId],
  );

  const eligibleCourt = useMemo(
    () => myCourt.filter((r) => !r.hasAttackedThisTurn),
    [myCourt],
  );

  const [blocks, setBlocks] = useState<Record<string, string[]>>({});

  const toggleBlock = useCallback((attackerCardId: string, blockerCardId: string) => {
    setBlocks((prev) => {
      const updated = { ...prev };
      const existing = updated[attackerCardId] ?? [];

      if (existing.includes(blockerCardId)) {
        const next = existing.filter((id) => id !== blockerCardId);
        if (next.length === 0) {
          delete updated[attackerCardId];
        } else {
          updated[attackerCardId] = next;
        }
      } else {
        for (const [atkId, blkIds] of Object.entries(updated)) {
          if (atkId !== attackerCardId && blkIds.includes(blockerCardId)) {
            updated[atkId] = blkIds.filter((id) => id !== blockerCardId);
            if (updated[atkId]!.length === 0) {
              delete updated[atkId];
            }
          }
        }
        updated[attackerCardId] = [...existing, blockerCardId];
      }

      return updated;
    });
  }, []);

  const passAttack = useCallback((attackerCardId: string) => {
    setBlocks((prev) => {
      const updated = { ...prev };
      if (updated[attackerCardId]?.length === 0 && !(attackerCardId in updated)) {
        return prev;
      }
      if (attackerCardId in updated && updated[attackerCardId]!.length === 0) {
        delete updated[attackerCardId];
        return updated;
      }
      if (attackerCardId in updated) {
        delete updated[attackerCardId];
      } else {
        updated[attackerCardId] = [];
      }
      return updated;
    });
  }, []);

  const isPassed = useCallback((attackerCardId: string): boolean => {
    return attackerCardId in blocks && blocks[attackerCardId]!.length === 0;
  }, [blocks]);

  const allAssigned = incomingAttacks.length > 0 &&
    incomingAttacks.every((a) => {
      if (isPassed(a.attackerCardId)) return true;
      const assigned = blocks[a.attackerCardId];
      return assigned && assigned.length > 0;
    });

  const isBlockerUsedFor = useCallback((blockerCardId: string, attackerCardId: string): boolean => {
    return (blocks[attackerCardId] ?? []).includes(blockerCardId);
  }, [blocks]);

  const isBlockerUsedElsewhere = useCallback((blockerCardId: string, attackerCardId: string): boolean => {
    for (const [atkId, blkIds] of Object.entries(blocks)) {
      if (atkId !== attackerCardId && blkIds.includes(blockerCardId)) return true;
    }
    return false;
  }, [blocks]);

  const handleConfirm = useCallback(() => {
    if (!allAssigned) return;
    const result: Record<string, string[]> = {};
    for (const atk of incomingAttacks) {
      if (isPassed(atk.attackerCardId)) {
        result[atk.attackerCardId] = [];
      } else {
        result[atk.attackerCardId] = blocks[atk.attackerCardId] ?? [];
      }
    }
    onConfirm(result);
    setBlocks({});
  }, [allAssigned, blocks, incomingAttacks, isPassed, onConfirm]);

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
              {onMinimize && (
                <Pressable onPress={onMinimize} style={styles.minimizeBtn} hitSlop={10}>
                  <Ionicons name="chevron-down" size={20} color={Colors.textMuted} />
                </Pressable>
              )}
            </View>
            <Text style={styles.attackDesc}>
              <Text style={styles.attackerName}>{attackerName}</Text>
              {" sends "}<Text style={styles.attackCount}>{incomingAttacks.length}</Text>
              {" Royal"}{incomingAttacks.length !== 1 ? "s" : ""}{" — assign blocks"}
            </Text>
            {onMinimize && (
              <Text style={styles.playCardsHint}>
                Tap ↓ to minimize and play cards on your Royals first
              </Text>
            )}
            {eligibleCourt.length < myCourt.length && (
              <Text style={styles.tappedNote}>
                Tapped Royals (those that attacked this turn) cannot block.
              </Text>
            )}
          </View>

          <ScrollView
            style={styles.attackList}
            contentContainerStyle={styles.attackListContent}
            showsVerticalScrollIndicator={false}
          >
            {incomingAttacks.map((atk) => {
              const atkCard = parseCardId(atk.attackerCardId);
              const assignedBlockers = blocks[atk.attackerCardId] ?? [];
              const isPass = isPassed(atk.attackerCardId);
              const isBlocked = assignedBlockers.length > 0;
              const atkRoyal = attackerCourt.find((r) => r.cardId === atk.attackerCardId);
              const atkAtk = atkRoyal ? effectiveAttack(atk.attackerCardId, atkRoyal.buffAttack) : null;
              const atkHp = atkRoyal ? effectiveHealth(atk.attackerCardId, atkRoyal.buffHealth, atkRoyal.damageTaken) : null;

              return (
                <View key={atk.attackerCardId} style={[
                  styles.attackRow,
                  isPass && styles.attackRowPassed,
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
                      {isPass && <Text style={styles.passedTag}>PASSING</Text>}
                      {isBlocked && (
                        <Text style={styles.blockedTag}>
                          ← {assignedBlockers.map((id) => {
                            const c = parseCardId(id);
                            return `${c.displayRank}${c.suitSymbol}`;
                          }).join(", ")}
                        </Text>
                      )}
                    </View>
                  </View>

                  <View style={styles.attackControls}>
                    {eligibleCourt.length > 0 && (
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.blockerRow}>
                        {eligibleCourt.map((royal) => {
                          const card = parseCardId(royal.cardId);
                          const assignedHere = isBlockerUsedFor(royal.cardId, atk.attackerCardId);
                          const usedElsewhere = isBlockerUsedElsewhere(royal.cardId, atk.attackerCardId);
                          const atk2 = effectiveAttack(royal.cardId, royal.buffAttack);
                          const hp = effectiveHealth(royal.cardId, royal.buffHealth, royal.damageTaken);

                          return (
                            <Pressable
                              key={royal.cardId}
                              onPress={() => !isPass && toggleBlock(atk.attackerCardId, royal.cardId)}
                              disabled={isPass}
                              style={({ pressed }) => [
                                styles.blockerChip,
                                assignedHere && styles.blockerChipSelected,
                                usedElsewhere && styles.blockerChipUsedElsewhere,
                                pressed && !isPass && { opacity: 0.75 },
                              ]}
                            >
                              <Text style={[styles.blockerChipText, { color: assignedHere ? Colors.bgDeep : card.suitColor }]}>
                                {card.displayRank}{card.suitSymbol}
                              </Text>
                              <Text style={[styles.blockerChipStats, { color: assignedHere ? Colors.bgDeep : Colors.textMuted }]}>
                                {atk2}/{hp}
                              </Text>
                              {usedElsewhere && (
                                <Text style={styles.multiBlockLabel}>+1</Text>
                              )}
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    )}
                    {myCourt.length > eligibleCourt.length && eligibleCourt.length === 0 && (
                      <Text style={styles.noEligibleText}>All your Royals are tapped</Text>
                    )}
                    <Pressable
                      onPress={() => passAttack(atk.attackerCardId)}
                      style={({ pressed }) => [
                        styles.passChip,
                        isPass && styles.passChipSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <Text style={[styles.passChipText, isPass && styles.passChipTextSelected]}>
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
                const isP = isPassed(a.attackerCardId);
                const assigned = blocks[a.attackerCardId];
                return (
                  <View
                    key={a.attackerCardId}
                    style={[
                      styles.progressDot,
                      isP ? styles.dotPassed :
                      assigned && assigned.length > 0 ? styles.dotBlocked :
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
    maxHeight: "85%",
  },
  header: {
    gap: 6,
    alignItems: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    width: "100%",
  },
  title: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
    flex: 1,
  },
  minimizeBtn: {
    padding: 4,
    borderRadius: 8,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  playCardsHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
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
  tappedNote: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
    fontStyle: "italic",
  },
  attackList: {
    maxHeight: 380,
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
  blockerChipUsedElsewhere: {
    borderColor: Colors.brand,
    backgroundColor: "rgba(200,155,60,0.15)",
  },
  blockerChipText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  blockerChipStats: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
  },
  multiBlockLabel: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.brand,
  },
  noEligibleText: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    fontStyle: "italic",
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
