import React, { useState, useCallback, useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { AttackDeclaration, RoyalInCourt } from "@workspace/api-client-react";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import Colors from "@/constants/colors";
import CardView from "./CardView";

interface DamageOrderModalProps {
  visible: boolean;
  attacks: AttackDeclaration[];
  attackerCourt: RoyalInCourt[];
  defenderCourt: RoyalInCourt[];
  isSubmitting: boolean;
  onConfirm: (assignments: Record<string, string[]>) => void;
}

function swap<T>(arr: T[], i: number, j: number): T[] {
  const copy = [...arr];
  const tmp = copy[i]!;
  copy[i] = copy[j]!;
  copy[j] = tmp;
  return copy;
}

export default function DamageOrderModal({
  visible,
  attacks,
  attackerCourt,
  defenderCourt,
  isSubmitting,
  onConfirm,
}: DamageOrderModalProps) {
  const multiBlockedAttacks = useMemo(
    () => attacks.filter((a) => (a.blockerCardIds?.length ?? 0) > 1),
    [attacks],
  );

  const [orders, setOrders] = useState<Record<string, string[]>>(() => {
    const init: Record<string, string[]> = {};
    for (const atk of multiBlockedAttacks) {
      init[atk.attackerCardId] = [...(atk.blockerCardIds ?? [])];
    }
    return init;
  });

  const move = useCallback((attackerId: string, idx: number, dir: -1 | 1) => {
    setOrders((prev) => {
      const current = prev[attackerId] ?? [];
      const next = idx + dir;
      if (next < 0 || next >= current.length) return prev;
      return { ...prev, [attackerId]: swap(current, idx, next) };
    });
  }, []);

  const handleConfirm = useCallback(() => {
    onConfirm(orders);
  }, [orders, onConfirm]);

  if (!visible || multiBlockedAttacks.length === 0) return null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          <View style={styles.header}>
            <Ionicons name="list" size={20} color={Colors.brand} />
            <View style={styles.headerText}>
              <Text style={styles.title}>Set Damage Order</Text>
              <Text style={styles.subtitle}>
                Set the order your attacker deals damage to each group of blockers.
                Damage flows down the list; excess is lost.
              </Text>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={styles.list}>
            {multiBlockedAttacks.map((atk) => {
              const atkRoyal = attackerCourt.find((r) => r.cardId === atk.attackerCardId);
              const atkCard = parseCardId(atk.attackerCardId);
              const atkAtk = atkRoyal ? effectiveAttack(atk.attackerCardId, atkRoyal.buffAttack) : 0;
              const order = orders[atk.attackerCardId] ?? (atk.blockerCardIds ?? []);

              return (
                <View key={atk.attackerCardId} style={styles.attackBlock}>
                  <View style={styles.attackerRow}>
                    <CardView cardId={atk.attackerCardId} size="sm" />
                    <View>
                      <Text style={[styles.attackerRank, { color: atkCard.suitColor }]}>
                        {atkCard.displayRank}{atkCard.suitSymbol} attacks
                      </Text>
                      <Text style={styles.attackerAtk}>⚔ {atkAtk} damage to distribute</Text>
                    </View>
                  </View>

                  <Text style={styles.orderLabel}>DAMAGE ORDER (first → last)</Text>

                  {order.map((blockerId, idx) => {
                    const blkRoyal = defenderCourt.find((r) => r.cardId === blockerId);
                    const blkCard = parseCardId(blockerId);
                    const blkAtk = blkRoyal ? effectiveAttack(blockerId, blkRoyal.buffAttack) : 0;
                    const blkHp = blkRoyal ? effectiveHealth(blockerId, blkRoyal.buffHealth, blkRoyal.damageTaken) : 0;

                    return (
                      <View key={blockerId} style={styles.blockerOrderRow}>
                        <Text style={styles.orderNum}>{idx + 1}</Text>
                        <CardView cardId={blockerId} size="sm" />
                        <View style={styles.blockerInfo}>
                          <Text style={[styles.blockerRank, { color: blkCard.suitColor }]}>
                            {blkCard.displayRank}{blkCard.suitSymbol}
                          </Text>
                          <Text style={styles.blockerStats}>⚔{blkAtk} ♥{blkHp}</Text>
                        </View>
                        <View style={styles.arrows}>
                          <Pressable
                            onPress={() => move(atk.attackerCardId, idx, -1)}
                            disabled={idx === 0}
                            style={({ pressed }) => [styles.arrowBtn, idx === 0 && styles.arrowDisabled, pressed && { opacity: 0.6 }]}
                          >
                            <Ionicons name="chevron-up" size={16} color={idx === 0 ? Colors.textMuted : Colors.textPrimary} />
                          </Pressable>
                          <Pressable
                            onPress={() => move(atk.attackerCardId, idx, 1)}
                            disabled={idx === order.length - 1}
                            style={({ pressed }) => [styles.arrowBtn, idx === order.length - 1 && styles.arrowDisabled, pressed && { opacity: 0.6 }]}
                          >
                            <Ionicons name="chevron-down" size={16} color={idx === order.length - 1 ? Colors.textMuted : Colors.textPrimary} />
                          </Pressable>
                        </View>
                      </View>
                    );
                  })}
                </View>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={handleConfirm}
            disabled={isSubmitting}
            style={({ pressed }) => [styles.confirmBtn, isSubmitting && styles.confirmBtnDisabled, pressed && { opacity: 0.8 }]}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.bgDeep} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={18} color={Colors.bgDeep} />
                <Text style={styles.confirmText}>Confirm Damage Order</Text>
              </>
            )}
          </Pressable>
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
    borderColor: Colors.brand,
    paddingHorizontal: 16,
    paddingTop: 20,
    paddingBottom: 32,
    gap: 16,
    maxHeight: "85%",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  headerText: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  subtitle: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  list: {
    maxHeight: 400,
  },
  attackBlock: {
    gap: 8,
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  attackerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  attackerRank: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  attackerAtk: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  orderLabel: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    marginTop: 4,
  },
  blockerOrderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: Colors.bgDeep,
    borderRadius: 10,
    padding: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  orderNum: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    width: 18,
    textAlign: "center",
  },
  blockerInfo: {
    flex: 1,
    gap: 2,
  },
  blockerRank: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  blockerStats: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  arrows: {
    flexDirection: "column",
    gap: 2,
  },
  arrowBtn: {
    padding: 4,
    borderRadius: 6,
    backgroundColor: Colors.bgSurface,
  },
  arrowDisabled: {
    opacity: 0.3,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: Colors.brand,
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
});
