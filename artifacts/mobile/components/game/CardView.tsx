import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { parseCardId } from "@/lib/gameUtils";
import type { RoyalInCourt } from "@workspace/api-client-react";
import Colors from "@/constants/colors";

interface CardViewProps {
  cardId: string;
  royal?: RoyalInCourt;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
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

  const cardBg = card.isJoker ? "#FDF6D8" : Colors.bgCardFace;
  const borderCol = selected
    ? Colors.brand
    : hasAttacked
    ? "#B0A070"
    : card.isJoker
    ? Colors.brand
    : "#C8B070";

  return (
    <View
      style={[
        styles.card,
        {
          width: s.w,
          height: s.h,
          borderColor: borderCol,
          borderWidth: selected ? 2.5 : 1.5,
          opacity: dimmed ? 0.5 : 1,
          backgroundColor: cardBg,
          elevation: selected ? 8 : 3,
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

      {royal?.hasteLocked && (
        <View style={styles.hasteLock}>
          <Text style={[styles.hasteLockText, { fontSize: s.iconFont }]}>⏳</Text>
        </View>
      )}

    </View>
  );
}

const SIZE_MAP = {
  xs: { w: 28, h: 40, rankFont: 11, symbolFont: 9, iconFont: 6 },
  sm: { w: 38, h: 52, rankFont: 14, symbolFont: 12, iconFont: 7 },
  md: { w: 52, h: 72, rankFont: 18, symbolFont: 15, iconFont: 8 },
  lg: { w: 68, h: 96, rankFont: 22, symbolFont: 19, iconFont: 9 },
  xl: { w: 84, h: 118, rankFont: 28, symbolFont: 23, iconFont: 11 },
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 8,
    padding: 4,
    alignItems: "center",
    justifyContent: "flex-start",
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
  hasteLock: {
    position: "absolute",
    top: 3,
    right: 3,
  },
  hasteLockText: {},
});
