import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { parseCardId, effectiveAttack, effectiveHealth } from "@/lib/gameUtils";
import type { RoyalInCourt } from "@workspace/api-client-react";
import Colors from "@/constants/colors";

interface CardViewProps {
  cardId: string;
  royal?: RoyalInCourt;
  size?: "sm" | "md" | "lg";
  dimmed?: boolean;
  selected?: boolean;
  hasAttacked?: boolean;
}

export default function CardView({
  cardId,
  royal,
  size = "md",
  dimmed = false,
  selected = false,
  hasAttacked = false,
}: CardViewProps) {
  const card = parseCardId(cardId);
  const s = SIZE_MAP[size];

  const atk = royal ? effectiveAttack(cardId, royal.buffAttack) : null;
  const hp = royal ? effectiveHealth(cardId, royal.buffHealth, royal.damageTaken) : null;
  const maxHp = royal ? (hp !== null && royal.damageTaken > 0 ? hp + royal.damageTaken : hp) : null;

  return (
    <View
      style={[
        styles.card,
        {
          width: s.w,
          height: s.h,
          borderColor: selected
            ? Colors.brand
            : hasAttacked
            ? Colors.textMuted
            : card.isJoker
            ? Colors.brand
            : Colors.border,
          borderWidth: selected ? 2 : 1,
          opacity: dimmed ? 0.45 : 1,
          backgroundColor: card.isJoker
            ? "rgba(200,155,60,0.12)"
            : Colors.bgCard,
        },
      ]}
    >
      <View style={styles.top}>
        <Text style={[styles.rank, { fontSize: s.rankFont, color: card.suitColor }]}>
          {card.displayRank}
        </Text>
        <Text style={[styles.symbol, { fontSize: s.symbolFont, color: card.suitColor }]}>
          {card.suitSymbol}
        </Text>
      </View>

      {card.isRoyal && royal && atk !== null && hp !== null && (
        <View style={styles.statsRow}>
          <View style={[styles.statBadge, styles.atkBadge]}>
            <Text style={[styles.statText, { fontSize: s.statFont }]}>⚔{atk}</Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: hp <= 0 ? Colors.accentRed : "rgba(39,174,96,0.25)" }]}>
            <Text style={[styles.statText, { fontSize: s.statFont, color: hp <= 0 ? Colors.accentRed : Colors.accentGreen }]}>♥{hp}</Text>
          </View>
        </View>
      )}

      {royal?.hasteLocked && (
        <View style={styles.hasteLock}>
          <Text style={styles.hasteLockText}>⏳</Text>
        </View>
      )}

      {royal?.attachedCards && royal.attachedCards.length > 0 && (
        <View style={styles.attachBadge}>
          <Text style={styles.attachText}>+{royal.attachedCards.length}</Text>
        </View>
      )}
    </View>
  );
}

const SIZE_MAP = {
  sm: { w: 38, h: 52, rankFont: 10, symbolFont: 9, statFont: 8 },
  md: { w: 52, h: 72, rankFont: 13, symbolFont: 11, statFont: 9 },
  lg: { w: 68, h: 96, rankFont: 17, symbolFont: 14, statFont: 11 },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    borderWidth: 1,
    padding: 4,
    alignItems: "center",
    justifyContent: "space-between",
    overflow: "hidden",
    position: "relative",
  },
  top: {
    alignItems: "center",
    gap: 1,
  },
  rank: {
    fontFamily: "Inter_700Bold",
    lineHeight: undefined,
  },
  symbol: {
    lineHeight: undefined,
  },
  statsRow: {
    flexDirection: "row",
    gap: 2,
  },
  statBadge: {
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  atkBadge: {
    backgroundColor: "rgba(200,155,60,0.2)",
  },
  statText: {
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
  },
  hasteLock: {
    position: "absolute",
    top: 2,
    right: 2,
  },
  hasteLockText: {
    fontSize: 8,
  },
  attachBadge: {
    position: "absolute",
    bottom: 2,
    right: 2,
    backgroundColor: Colors.bgSurface,
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 0,
  },
  attachText: {
    fontSize: 7,
    color: Colors.textMuted,
    fontFamily: "Inter_600SemiBold",
  },
});
