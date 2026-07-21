import React, { useMemo, useState, useCallback } from "react";
import { View, Text, Pressable, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import type { AttackDeclaration, RoyalInCourt } from "@workspace/api-client-react";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { Tints } from "@/constants/theme";

interface BlockPanelProps {
  attacks: AttackDeclaration[];
  myId: string;
  myCourt: RoyalInCourt[];
  attackerCourt: RoyalInCourt[];
  attackerName: string;
  attackerColor: string;
  isSubmitting: boolean;
  onConfirm: (blocks: Record<string, string[]>) => void;
  /**
   * When the player has a card armed that targets their own Royals (e.g. a
   * Spade/Heart attach while blocking), tapping a Royal chip attaches to it
   * instead of toggling the block — so buffs can be played without leaving
   * the block window.
   */
  attachTargeting?: { hint: string; onAttach: (royalId: string) => void };
  /**
   * When the player has a card armed that targets any Royal (e.g. a Club
   * debuff), the attacker cards in this panel become valid tap targets:
   * they glow and a tap applies the card to that Royal instead of switching
   * the active attack lane.
   */
  attackerTargeting?: { onTarget: (royalId: string) => void };
}

/** Inline blocking panel rendered in the table center — the board, your court
    and your hand all stay visible and usable while you assign blocks.
    Replaces the old full-screen BlockingModal (and its "minimize" workaround). */
export default function BlockPanel({
  attacks,
  myId,
  myCourt,
  attackerCourt,
  attackerName,
  attackerColor,
  isSubmitting,
  onConfirm,
  attachTargeting,
  attackerTargeting,
}: BlockPanelProps) {
  const incomingAttacks = useMemo(
    () => attacks.filter((a) => a.targetPlayerId === myId),
    [attacks, myId],
  );

  const eligibleCourt = useMemo(
    () => myCourt.filter((r) => !r.hasAttackedThisTurn),
    [myCourt],
  );

  const [blocks, setBlocks] = useState<Record<string, string[]>>({});
  const [activeAttackerId, setActiveAttackerId] = useState<string | null>(
    incomingAttacks[0]?.attackerCardId ?? null,
  );

  const toggleBlock = useCallback((attackerCardId: string, blockerCardId: string) => {
    setBlocks((prev) => {
      const updated = { ...prev };
      const existing = updated[attackerCardId] ?? [];

      if (existing.includes(blockerCardId)) {
        const next = existing.filter((id) => id !== blockerCardId);
        if (next.length === 0) delete updated[attackerCardId];
        else updated[attackerCardId] = next;
      } else {
        // A Royal can only block one attacker — pull it off any other lane.
        for (const [atkId, blkIds] of Object.entries(updated)) {
          if (atkId !== attackerCardId && blkIds.includes(blockerCardId)) {
            updated[atkId] = blkIds.filter((id) => id !== blockerCardId);
            if (updated[atkId]!.length === 0) delete updated[atkId];
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
      if (attackerCardId in updated && updated[attackerCardId]!.length === 0) {
        delete updated[attackerCardId];
      } else {
        updated[attackerCardId] = [];
      }
      return updated;
    });
  }, []);

  const isPassed = useCallback(
    (attackerCardId: string) => attackerCardId in blocks && blocks[attackerCardId]!.length === 0,
    [blocks],
  );

  const allAssigned =
    incomingAttacks.length > 0 &&
    incomingAttacks.every(
      (a) => isPassed(a.attackerCardId) || (blocks[a.attackerCardId]?.length ?? 0) > 0,
    );

  // Live damage preview: attack values of everything currently let through.
  const unblockedDamage = incomingAttacks.reduce((sum, a) => {
    const blocked = (blocks[a.attackerCardId]?.length ?? 0) > 0;
    if (blocked) return sum;
    const royal = attackerCourt.find((r) => r.cardId === a.attackerCardId);
    return sum + (royal ? effectiveAttack(a.attackerCardId, royal.buffAttack) : parseCardId(a.attackerCardId).pipValue);
  }, 0);

  const handleConfirm = useCallback(() => {
    if (!allAssigned) return;
    const result: Record<string, string[]> = {};
    for (const atk of incomingAttacks) {
      result[atk.attackerCardId] = isPassed(atk.attackerCardId)
        ? []
        : (blocks[atk.attackerCardId] ?? []);
    }
    onConfirm(result);
  }, [allAssigned, blocks, incomingAttacks, isPassed, onConfirm]);

  if (incomingAttacks.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.duration(250)} style={[styles.panel, { borderColor: attackerColor }]}>
      <View style={styles.header}>
        <Ionicons name="shield" size={16} color={attackerColor} />
        <Text style={styles.title}>
          <Text style={{ color: attackerColor }}>{attackerName}</Text> attacks — choose your blocks
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.attackRow}
      >
        {incomingAttacks.map((atk) => {
          const atkCard = parseCardId(atk.attackerCardId);
          const atkRoyal = attackerCourt.find((r) => r.cardId === atk.attackerCardId);
          const atkVal = atkRoyal ? effectiveAttack(atk.attackerCardId, atkRoyal.buffAttack) : atkCard.pipValue;
          const atkHp = atkRoyal ? effectiveHealth(atk.attackerCardId, atkRoyal.buffHealth, atkRoyal.damageTaken) : null;
          const assigned = (blocks[atk.attackerCardId] ?? []).length > 0;
          const passed = isPassed(atk.attackerCardId);
          const isActive = activeAttackerId === atk.attackerCardId;

          return (
            <Pressable
              key={atk.attackerCardId}
              onPress={() =>
                attackerTargeting
                  ? attackerTargeting.onTarget(atk.attackerCardId)
                  : setActiveAttackerId(atk.attackerCardId)
              }
              style={({ pressed }) => [
                styles.attackerCol,
                isActive && !attackerTargeting && [styles.attackerColActive, { borderColor: attackerColor }],
                attackerTargeting && styles.attackerColTarget,
                pressed && { opacity: 0.8 },
              ]}
            >
              <CardView cardId={atk.attackerCardId} size="md" />
              <Text style={styles.attackerVal}>
                ⚔{atkVal}
                {atkHp !== null && <Text style={styles.attackerHp}>  ♥{atkHp}</Text>}
              </Text>
              {assigned ? (
                <View style={styles.stateChipBlocked}>
                  <Text style={styles.stateChipBlockedText}>
                    🛡 {(blocks[atk.attackerCardId] ?? [])
                      .map((id) => {
                        const c = parseCardId(id);
                        return `${c.displayRank}${c.suitSymbol}`;
                      })
                      .join(" ")}
                  </Text>
                </View>
              ) : passed ? (
                <View style={styles.stateChipPass}>
                  <Text style={styles.stateChipPassText}>🔻 through</Text>
                </View>
              ) : (
                <View style={styles.stateChipPending}>
                  <Text style={styles.stateChipPendingText}>?</Text>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Attach mode: a selected Spade/Heart re-purposes the Royal chips as
          attach targets so buffs can be played without leaving this panel. */}
      {attachTargeting && (
        <View style={styles.attachBanner}>
          <Text style={styles.attachBannerText}>{attachTargeting.hint}</Text>
        </View>
      )}

      {activeAttackerId && (
        <View style={styles.blockerSection}>
          <Text style={styles.blockerLabel}>
            {attachTargeting
              ? "Your Royals — tap one to attach:"
              : `Block ${parseCardId(activeAttackerId).displayRank}${parseCardId(activeAttackerId).suitSymbol} with:`}
          </Text>
          {eligibleCourt.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.blockerRow}>
              {eligibleCourt.map((royal) => {
                const card = parseCardId(royal.cardId);
                const usedHere = (blocks[activeAttackerId] ?? []).includes(royal.cardId);
                const usedElsewhere = Object.entries(blocks).some(
                  ([atkId, ids]) => atkId !== activeAttackerId && ids.includes(royal.cardId),
                );
                const atkV = effectiveAttack(royal.cardId, royal.buffAttack);
                const hpV = effectiveHealth(royal.cardId, royal.buffHealth, royal.damageTaken);
                return (
                  <Pressable
                    key={royal.cardId}
                    onPress={() =>
                      attachTargeting
                        ? attachTargeting.onAttach(royal.cardId)
                        : toggleBlock(activeAttackerId, royal.cardId)
                    }
                    style={({ pressed }) => [
                      styles.blockerChip,
                      usedHere && styles.blockerChipSelected,
                      usedElsewhere && !attachTargeting && styles.blockerChipUsedElsewhere,
                      attachTargeting && styles.blockerChipAttachTarget,
                      pressed && { opacity: 0.75 },
                    ]}
                  >
                    <Text style={[styles.blockerChipCard, { color: usedHere ? Colors.bgDeep : card.suitColor }]}>
                      {card.displayRank}{card.suitSymbol}
                    </Text>
                    <Text style={[styles.blockerChipStats, usedHere && { color: Colors.bgDeep }]}>
                      ⚔{atkV} ♥{hpV}
                    </Text>
                    {usedElsewhere && !attachTargeting && <Text style={styles.movedLabel}>↺ move</Text>}
                  </Pressable>
                );
              })}
            </ScrollView>
          ) : (
            <Text style={styles.noBlockers}>No Royals can block this one — let it through.</Text>
          )}
          {/* Always-visible below the chips so it can't be pushed off-screen. */}
          <Pressable
            onPress={() => passAttack(activeAttackerId)}
            style={({ pressed }) => [
              styles.passChip,
              isPassed(activeAttackerId) && styles.passChipSelected,
              pressed && { opacity: 0.8 },
            ]}
          >
            <Text style={[styles.passChipText, isPassed(activeAttackerId) && { color: "#FFD9D9" }]}>
              🔻 Let through
            </Text>
          </Pressable>
        </View>
      )}

      <View style={styles.footer}>
        <Text style={[styles.preview, unblockedDamage > 0 && styles.previewDanger]}>
          {unblockedDamage > 0 ? `Unblocked: ${unblockedDamage} damage → you` : "All attacks covered"}
        </Text>
        <Pressable
          onPress={handleConfirm}
          disabled={!allAssigned || isSubmitting}
          style={({ pressed }) => [
            styles.confirmBtn,
            (!allAssigned || isSubmitting) && styles.confirmBtnDisabled,
            pressed && allAssigned && { opacity: 0.85 },
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color={Colors.bgDeep} />
          ) : (
            <Text style={[styles.confirmBtnText, !allAssigned && { color: Colors.textMuted }]}>
              {allAssigned ? "Confirm blocks" : "Decide every attack"}
            </Text>
          )}
        </Pressable>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    marginHorizontal: 8,
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    borderWidth: 2,
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
    color: Colors.textPrimary,
  },
  attackRow: {
    gap: 8,
  },
  attackerCol: {
    alignItems: "center",
    gap: 3,
    padding: 5,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
  },
  attackerColActive: {
    backgroundColor: Tints.white,
  },
  attackerColTarget: {
    borderColor: Colors.brand,
    backgroundColor: "rgba(200,155,60,0.12)",
    shadowColor: Colors.brand,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  attackerVal: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
  },
  attackerHp: {
    color: Colors.suitFx.C.accent,
  },
  stateChipBlocked: {
    backgroundColor: Tints.green,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stateChipBlockedText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.accentGreenSoft,
  },
  stateChipPass: {
    backgroundColor: Tints.crimson,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  stateChipPassText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRedSoft,
  },
  stateChipPending: {
    backgroundColor: Colors.bgSurface,
    borderRadius: 5,
    paddingHorizontal: 7,
    paddingVertical: 1,
  },
  stateChipPendingText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
  },
  blockerSection: {
    gap: 5,
  },
  blockerLabel: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  blockerRow: {
    gap: 8,
    alignItems: "center",
  },
  blockerChip: {
    alignItems: "center",
    backgroundColor: Colors.bgSurface,
    borderRadius: 9,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    gap: 1,
  },
  blockerChipSelected: {
    backgroundColor: Colors.accentGreenSoft,
    borderColor: Colors.accentGreenSoft,
  },
  blockerChipUsedElsewhere: {
    opacity: 0.6,
  },
  blockerChipAttachTarget: {
    borderColor: Colors.brand,
  },
  attachBanner: {
    backgroundColor: "rgba(200,155,60,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.35)",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  attachBannerText: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
  },
  blockerChipCard: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
  },
  blockerChipStats: {
    fontSize: 10,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  movedLabel: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
  },
  noBlockers: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    paddingRight: 8,
  },
  passChip: {
    alignSelf: "flex-start",
    backgroundColor: Tints.crimson,
    borderWidth: 1.5,
    borderColor: Tints.redBorder,
    borderRadius: 9,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  passChipSelected: {
    backgroundColor: "rgba(200,16,46,0.45)",
    borderColor: Colors.accentRed,
  },
  passChipText: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  preview: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.accentGreenSoft,
  },
  previewDanger: {
    color: Colors.accentRedSoft,
  },
  confirmBtn: {
    backgroundColor: Colors.brand,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  confirmBtnDisabled: {
    backgroundColor: Colors.bgSurface,
  },
  confirmBtnText: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.bgDeep,
  },
});
