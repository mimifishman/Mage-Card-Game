import React, { useMemo } from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  Modal,
  ScrollView,
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
  displayNames: Record<string, string>;
  passedIds: Set<string>;
  isSubmitting: boolean;
  onBlock: (blockerRoyalId: string, attackerRoyalId: string) => void;
  onPass: (attackerRoyalId: string) => void;
  onDismiss: () => void;
}

export default function BlockingModal({
  visible,
  attacks,
  myId,
  myCourt,
  displayNames,
  passedIds,
  isSubmitting,
  onBlock,
  onPass,
  onDismiss,
}: BlockingModalProps) {
  const incomingAttacks = useMemo(
    () => attacks.filter((a) => a.targetPlayerId === myId),
    [attacks, myId],
  );

  const currentAttack = incomingAttacks.find(
    (a) => !a.blockerCardId && !passedIds.has(a.attackerCardId),
  );

  const allHandled = incomingAttacks.length > 0 &&
    incomingAttacks.every(
      (a) => a.blockerCardId || passedIds.has(a.attackerCardId),
    );

  if (!visible || incomingAttacks.length === 0) return null;

  const attackerName =
    displayNames[currentAttack?.attackerPlayerId ?? ""] ??
    (currentAttack?.attackerPlayerId?.slice(0, 8) ?? "Opponent");

  const attackerCardId = currentAttack?.attackerCardId;
  const attackerCard = attackerCardId ? parseCardId(attackerCardId) : null;

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {allHandled ? (
            <View style={styles.doneSection}>
              <Ionicons name="shield-checkmark" size={44} color={Colors.accentGreen} />
              <Text style={styles.doneTitle}>Blocks Declared</Text>
              <Text style={styles.doneSubtitle}>
                Waiting for the attacker to resolve combat...
              </Text>
              <Pressable
                onPress={onDismiss}
                style={({ pressed }) => [styles.dismissBtn, pressed && { opacity: 0.8 }]}
              >
                <Text style={styles.dismissText}>Dismiss</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <View style={styles.header}>
                <View style={styles.titleRow}>
                  <Ionicons name="flash" size={18} color={Colors.accentRed} />
                  <Text style={styles.title}>Incoming Attack!</Text>
                </View>
                {attackerCard && (
                  <Text style={styles.attackDesc}>
                    <Text style={styles.attackerName}>{attackerName}</Text>
                    {" attacks with "}
                    <Text style={{ color: attackerCard.suitColor }}>
                      {attackerCard.displayRank}{attackerCard.suitSymbol}
                    </Text>
                  </Text>
                )}
              </View>

              {incomingAttacks.length > 1 && (
                <View style={styles.progressRow}>
                  {incomingAttacks.map((a) => (
                    <View
                      key={a.attackerCardId}
                      style={[
                        styles.progressDot,
                        a.blockerCardId
                          ? styles.dotBlocked
                          : passedIds.has(a.attackerCardId)
                          ? styles.dotPassed
                          : a === currentAttack
                          ? styles.dotActive
                          : styles.dotPending,
                      ]}
                    />
                  ))}
                </View>
              )}

              <Text style={styles.pickLabel}>
                {myCourt.length > 0
                  ? "Tap a Royal to block, or pass"
                  : "No Royals to block with"}
              </Text>

              {myCourt.length > 0 ? (
                <ScrollView
                  style={styles.blockerList}
                  contentContainerStyle={styles.blockerContent}
                  showsVerticalScrollIndicator={false}
                >
                  {myCourt.map((royal) => {
                    const card = parseCardId(royal.cardId);
                    const atk = effectiveAttack(royal.cardId, royal.buffAttack);
                    const hp = effectiveHealth(
                      royal.cardId,
                      royal.buffHealth,
                      royal.damageTaken,
                    );
                    const alreadyBlocking = attacks.some(
                      (a) => a.blockerCardId === royal.cardId,
                    );
                    return (
                      <Pressable
                        key={royal.cardId}
                        onPress={() => !alreadyBlocking && onBlock(royal.cardId, currentAttack!.attackerCardId)}
                        disabled={alreadyBlocking || isSubmitting}
                        style={({ pressed }) => [
                          styles.blockerOption,
                          alreadyBlocking && styles.blockerUsed,
                          pressed && !alreadyBlocking && { opacity: 0.75 },
                        ]}
                      >
                        <CardView cardId={royal.cardId} royal={royal} size="md" />
                        <View style={styles.blockerInfo}>
                          <Text style={[styles.blockerName, { color: card.suitColor }]}>
                            {card.displayRank}{card.suitSymbol}
                          </Text>
                          <Text style={styles.blockerStats}>
                            ATK {atk}  HP {hp}
                          </Text>
                          {alreadyBlocking && (
                            <View style={styles.blockingBadge}>
                              <Text style={styles.blockingBadgeText}>BLOCKING</Text>
                            </View>
                          )}
                        </View>
                        {!alreadyBlocking && (
                          <Ionicons name="shield" size={20} color={Colors.accentGreen} />
                        )}
                      </Pressable>
                    );
                  })}
                </ScrollView>
              ) : (
                <View style={styles.noBlockersPlaceholder} />
              )}

              <Pressable
                onPress={() => onPass(currentAttack!.attackerCardId)}
                style={({ pressed }) => [styles.passBtn, pressed && { opacity: 0.8 }]}
              >
                <Ionicons name="arrow-forward-circle" size={18} color={Colors.textMuted} />
                <Text style={styles.passText}>Pass (take damage)</Text>
              </Pressable>
            </>
          )}
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
    borderColor: Colors.border,
    paddingHorizontal: 20,
    paddingTop: 24,
    paddingBottom: 40,
    gap: 16,
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
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textSecondary,
    textAlign: "center",
  },
  attackerName: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  progressDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.bgSurface,
  },
  dotActive: {
    backgroundColor: Colors.brand,
    width: 12,
    borderRadius: 6,
  },
  dotBlocked: {
    backgroundColor: Colors.accentGreen,
  },
  dotPassed: {
    backgroundColor: Colors.accentRed,
  },
  dotPending: {
    backgroundColor: Colors.bgSurface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  pickLabel: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 0.5,
    textAlign: "center",
  },
  blockerList: {
    maxHeight: 200,
  },
  blockerContent: {
    gap: 10,
  },
  blockerOption: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  blockerUsed: {
    opacity: 0.5,
  },
  blockerInfo: {
    flex: 1,
    gap: 4,
  },
  blockerName: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
  },
  blockerStats: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    letterSpacing: 0.5,
  },
  blockingBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(39,174,96,0.15)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.accentGreen,
  },
  blockingBadgeText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.accentGreen,
    letterSpacing: 1,
  },
  noBlockersPlaceholder: {
    height: 20,
  },
  passBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgSurface,
  },
  passText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  doneSection: {
    alignItems: "center",
    gap: 12,
    paddingVertical: 20,
  },
  doneTitle: {
    fontSize: 22,
    fontFamily: "Inter_700Bold",
    color: Colors.accentGreen,
  },
  doneSubtitle: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
  dismissBtn: {
    marginTop: 8,
    paddingVertical: 12,
    paddingHorizontal: 32,
    backgroundColor: Colors.bgSurface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissText: {
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
});
