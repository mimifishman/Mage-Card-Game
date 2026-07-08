import React from "react";
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  ScrollView,
} from "react-native";
import type { RoyalInCourt } from "@workspace/api-client-react";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { effectiveAttack, effectiveHealth, royalBaseHealth, parseCardId, type Rank } from "@/lib/gameUtils";

interface CourtZoneProps {
  court: RoyalInCourt[];
  label?: string;
  isMyZone?: boolean;
  isMyTurn?: boolean;
  selectedTargetId?: string | null;
  onRoyalPress?: (royalId: string) => void;
  size?: "sm" | "md" | "lg" | "xl";
  phase?: string;
  isDefender?: boolean;
  highlightedIds?: Set<string>;
  dimmedIds?: Set<string>;
  highlightBadgeText?: string;
}

const ATTACHED_SIZE: Record<"sm" | "md" | "lg" | "xl", "xs" | "sm" | "md" | "lg" | "xl"> = {
  sm: "xs",
  md: "xs",
  lg: "xs",
  xl: "sm",
};

export default function CourtZone({
  court,
  label,
  isMyZone = false,
  isMyTurn = false,
  selectedTargetId = null,
  onRoyalPress,
  size = "md",
  phase,
  isDefender = false,
  highlightedIds,
  dimmedIds,
  highlightBadgeText,
}: CourtZoneProps) {
  const statFontSize = size === "xl" ? 14 : size === "lg" ? 13 : 11;

  return (
    <View style={styles.container}>
      {label && (
        <Text style={[styles.label, isMyZone && styles.labelMine]}>{label}</Text>
      )}
      {court.length === 0 ? (
        <View style={[styles.emptySlot, isMyZone && styles.emptySlotMine]}>
          <Text style={[styles.emptyText, isMyZone && styles.emptyTextMine]}>Empty Court</Text>
        </View>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {court.map((royal) => {
            const isTapped = royal.hasAttackedThisTurn;
            const isBlockerIneligible = isDefender && phase === "declare_blocks" && isTapped;
            const isDimmed = dimmedIds?.has(royal.cardId) || isBlockerIneligible;
            const isHighlighted = highlightedIds?.has(royal.cardId);
            const canInteract = !!onRoyalPress && !isDimmed;
            const isSelected = selectedTargetId === royal.cardId;

            const card = parseCardId(royal.cardId);
            const atk = effectiveAttack(royal.cardId, royal.buffAttack);
            const hp = effectiveHealth(royal.cardId, royal.buffHealth, royal.damageTaken);
            const maxHp = royalBaseHealth(card.rank as Rank) + royal.buffHealth;
            const isDamaged = hp < maxHp;

            return (
              <Pressable
                key={royal.cardId}
                onPress={() => canInteract && onRoyalPress?.(royal.cardId)}
                style={({ pressed }) => [
                  styles.royalWrapper,
                  isTapped && styles.royalTapped,
                  isDimmed && styles.royalDimmed,
                  isHighlighted && styles.royalHighlighted,
                  isHighlighted && !!highlightBadgeText && styles.royalDuelGlow,
                  pressed && canInteract && { opacity: 0.75 },
                  isSelected && styles.royalSelected,
                ]}
                disabled={!canInteract}
              >
                <CardView
                  cardId={royal.cardId}
                  royal={royal}
                  size={size}
                  hasAttacked={royal.hasAttackedThisTurn}
                  selected={isSelected}
                />

                <View style={styles.statRow}>
                  <View style={styles.atkPill}>
                    <Text style={[styles.atkPillText, { fontSize: statFontSize }]}>
                      ⚔{atk}
                    </Text>
                  </View>
                  <View style={[styles.hpPill, isDamaged && styles.hpPillDamaged]}>
                    <Text style={[
                      styles.hpPillText,
                      { fontSize: statFontSize },
                      isDamaged && styles.hpPillTextDamaged,
                    ]}>
                      ♥{hp}
                    </Text>
                  </View>
                </View>

                {royal.attachedCards && royal.attachedCards.length > 0 && (
                  <View style={styles.attachedRow}>
                    {royal.attachedCards.map((attachedId) => (
                      <CardView
                        key={attachedId}
                        cardId={attachedId}
                        size={ATTACHED_SIZE[size]}
                      />
                    ))}
                  </View>
                )}

                {isHighlighted && !!highlightBadgeText && (
                  <View style={styles.duelBadge}>
                    <Text style={styles.duelBadgeText}>{highlightBadgeText}</Text>
                  </View>
                )}

                {isTapped && (
                  <View style={styles.tappedBadge}>
                    <Text style={styles.tappedText}>TAPPED</Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 4,
  },
  label: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
    paddingHorizontal: 4,
    textTransform: "uppercase",
  },
  labelMine: {
    color: Colors.textSecondary,
  },
  scrollContent: {
    gap: 6,
    paddingHorizontal: 4,
  },
  emptySlot: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: "dashed",
    minWidth: 60,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,43,26,0.5)",
  },
  emptySlotMine: {
    borderColor: Colors.borderLight,
    backgroundColor: "rgba(26,56,36,0.5)",
  },
  emptyText: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  emptyTextMine: {
    color: Colors.textSecondary,
  },
  royalWrapper: {
    alignItems: "center",
    gap: 4,
  },
  royalSelected: {
    transform: [{ translateY: -4 }],
  },
  royalTapped: {
    opacity: 0.65,
    transform: [{ rotate: "8deg" }],
  },
  royalDimmed: {
    opacity: 0.35,
  },
  royalHighlighted: {
    transform: [{ translateY: -4 }],
  },
  royalDuelGlow: {
    borderWidth: 2,
    borderColor: "#C89B3C",
    borderRadius: 10,
    backgroundColor: "rgba(200,155,60,0.12)",
    padding: 3,
  },
  duelBadge: {
    backgroundColor: "#C89B3C",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  duelBadgeText: {
    fontSize: 8,
    color: Colors.bgDeep,
    fontFamily: "Inter_700Bold",
    letterSpacing: 0.8,
  },
  statRow: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
  },
  atkPill: {
    backgroundColor: "rgba(200,155,60,0.30)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.55)",
  },
  atkPillText: {
    fontFamily: "Inter_700Bold",
    color: "#C89B3C",
  },
  hpPill: {
    backgroundColor: "rgba(27,94,32,0.28)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.55)",
  },
  hpPillDamaged: {
    backgroundColor: "rgba(200,16,46,0.14)",
    borderColor: "rgba(200,16,46,0.4)",
  },
  hpPillText: {
    fontFamily: "Inter_700Bold",
    color: "#66BB6A",
  },
  hpPillTextDamaged: {
    color: Colors.accentRed,
  },
  attachedRow: {
    flexDirection: "row",
    gap: 3,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  tappedBadge: {
    backgroundColor: "rgba(200,155,60,0.2)",
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(200,155,60,0.4)",
  },
  tappedText: {
    fontSize: 7,
    color: Colors.brand,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 0.5,
  },
});
