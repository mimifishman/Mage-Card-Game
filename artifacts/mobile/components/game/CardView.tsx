import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import Svg, { Circle, Path, Polygon } from "react-native-svg";
import { parseCardId } from "@/lib/gameUtils";
import type { RoyalInCourt } from "@workspace/api-client-react";
import Colors, { SUIT_FX, type SuitFxKey } from "@/constants/colors";
import { Gradients, Tints } from "@/constants/theme";

// ── The ornate card ──────────────────────────────────────────────────────
// Every card in the game renders through this component, so the "gilded
// relic" look here defines the whole board: a gradient metal frame (gold for
// pips, per-suit gem-metal for Royals), a parchment face with a faint
// suit-sigil watermark (doubling as the future art window), Cinzel ranks,
// and a gentle enchanted pulse on Royals. All code-drawn — no art assets.

interface CardViewProps {
  cardId: string;
  royal?: RoyalInCourt;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  dimmed?: boolean;
  selected?: boolean;
  hasAttacked?: boolean;
  /** Player can't currently pay this card's Vault cost — cost chip turns red. */
  unaffordable?: boolean;
  /** Seat-colored glow marking this card as a legal target right now. */
  glowColor?: string;
}

export default function CardView({
  cardId,
  royal,
  size = "md",
  dimmed = false,
  selected = false,
  hasAttacked = false,
  unaffordable = false,
  glowColor,
}: CardViewProps) {
  const card = parseCardId(cardId);
  const s = SIZE_MAP[size];

  const suitKey: SuitFxKey = card.isJoker ? "JOKER" : (card.suit as SuitFxKey);
  const fx = SUIT_FX[suitKey] ?? SUIT_FX.JOKER;

  const cardBg = card.isJoker ? "#FDF6D8" : Colors.bgCardFace;

  // Frame metal: Royals & Jokers wear their suit's gem-metal; pip cards get
  // quiet aged gold. A spent (attacked) card's frame tarnishes.
  const frameColors = hasAttacked
    ? (["#A99C7A", "#8B8268", "#6B6250"] as const)
    : card.isRoyal || card.isJoker
      ? ([fx.flash, fx.accent, fx.core] as const)
      : Gradients.goldFrame;

  const ringColor = glowColor ?? (selected ? Colors.brand : undefined);

  return (
    <View
      style={[
        {
          width: s.w,
          height: s.h,
          opacity: dimmed ? 0.5 : 1,
          elevation: selected || glowColor ? 8 : 3,
        },
        styles.outer,
        ringColor
          ? {
              shadowColor: ringColor,
              shadowOpacity: 0.9,
              shadowRadius: 6,
              shadowOffset: { width: 0, height: 0 },
            }
          : null,
      ]}
    >
      <LinearGradient colors={frameColors} style={[styles.frame, { padding: s.frame }]}>
        <View style={[styles.face, { backgroundColor: cardBg }]}>
          {/* Watermark sigil — the card's "art window" until real art exists. */}
          <View pointerEvents="none" style={styles.watermarkWrap}>
            <SuitSigil suit={suitKey} size={s.w * 0.62} color={card.suitColor} opacity={0.1} />
          </View>

          <View style={styles.top}>
            <Text
              style={[
                styles.rank,
                {
                  fontSize: s.rankFont,
                  color: card.suitColor,
                  fontFamily:
                    card.isRoyal || card.isJoker ? "CinzelDecorative_700Bold" : "Cinzel_700Bold",
                },
              ]}
            >
              {card.displayRank}
            </Text>
            <Text style={[styles.symbol, { fontSize: s.symbolFont, color: card.suitColor }]}>
              {card.suitSymbol}
            </Text>
          </View>

          {/* Mirrored corner sigil on hand-size cards, like a real deck. */}
          {(size === "lg" || size === "xl") && (
            <Text
              style={[
                styles.mirrorSymbol,
                { fontSize: s.symbolFont - 4, color: card.suitColor },
              ]}
            >
              {card.suitSymbol}
            </Text>
          )}

          {royal?.hasteLocked && (
            <View style={styles.hasteLock}>
              <Text style={[styles.hasteLockText, { fontSize: s.iconFont }]}>⏳</Text>
            </View>
          )}

          {/* Vault cost at a glance on hand-size cards — saves opening the
              action sheet just to check affordability. Diamonds cost 0 and
              show nothing. */}
          {(size === "lg" || size === "xl") && card.vaultCost > 0 && (
            <View style={[styles.costChip, unaffordable && styles.costChipUnaffordable]}>
              <Text
                style={[
                  styles.costChipText,
                  { fontSize: size === "xl" ? 10 : 9 },
                  unaffordable && styles.costChipTextUnaffordable,
                ]}
              >
                ⚡{card.vaultCost}
              </Text>
            </View>
          )}
        </View>
      </LinearGradient>

      {/* Target / selection ring drawn just outside the frame. */}
      {ringColor && (
        <View
          pointerEvents="none"
          style={[styles.ring, { borderColor: ringColor }]}
        />
      )}

      {/* Royals hum with a soft enchanted glow. Kept subtle and off for the
          tiny sizes where it would just read as blur. */}
      {card.isRoyal && !hasAttacked && !dimmed && size !== "xs" && size !== "sm" && (
        <EnchantedPulse color={fx.accent} />
      )}
    </View>
  );
}

/** Slow breathing glow behind a Royal — opacity-only, GPU-cheap. */
function EnchantedPulse({ color }: { color: string }) {
  const glow = useSharedValue(0.2);
  useEffect(() => {
    glow.value = withRepeat(
      withSequence(withTiming(0.5, { duration: 1600 }), withTiming(0.2, { duration: 1600 })),
      -1,
    );
  }, []);
  const style = useAnimatedStyle(() => ({ opacity: glow.value }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.pulse,
        style,
        {
          shadowColor: color,
          shadowOpacity: 1,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 0 },
          borderColor: color,
        },
      ]}
    />
  );
}

/** Static SVG suit sigils (24×24 viewBox) — watermark + future art window. */
export function SuitSigil({
  suit,
  size,
  color,
  opacity = 1,
}: {
  suit: SuitFxKey;
  size: number;
  color: string;
  opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" opacity={opacity}>
      {suit === "H" && (
        <Path
          d="M12 21 C12 21 3 14.5 3 8.5 C3 5.4 5.4 3 8.2 3 C9.8 3 11.2 3.9 12 5.2 C12.8 3.9 14.2 3 15.8 3 C18.6 3 21 5.4 21 8.5 C21 14.5 12 21 12 21 Z"
          fill={color}
        />
      )}
      {suit === "D" && <Polygon points="12,1 21,12 12,23 3,12" fill={color} />}
      {suit === "C" && (
        <>
          <Circle cx={12} cy={7} r={4.4} fill={color} />
          <Circle cx={7} cy={13.5} r={4.4} fill={color} />
          <Circle cx={17} cy={13.5} r={4.4} fill={color} />
          <Path d="M10.8 13 L13.2 13 L15 22 L9 22 Z" fill={color} />
        </>
      )}
      {suit === "S" && (
        <>
          <Path
            d="M12 2 C12 2 4 9 4 13.5 C4 16.2 6 18 8.4 18 C9.9 18 11.2 17.2 12 16 C12.8 17.2 14.1 18 15.6 18 C18 18 20 16.2 20 13.5 C20 9 12 2 12 2 Z"
            fill={color}
          />
          <Path d="M10.8 16 L13.2 16 L15 22.5 L9 22.5 Z" fill={color} />
        </>
      )}
      {suit === "JOKER" && (
        <Polygon
          points="12,1 14.5,8.2 22.2,8.6 16.2,13.4 18.2,20.9 12,16.6 5.8,20.9 7.8,13.4 1.8,8.6 9.5,8.2"
          fill={color}
        />
      )}
    </Svg>
  );
}

const SIZE_MAP = {
  xs: { w: 28, h: 40, rankFont: 11, symbolFont: 9, iconFont: 6, frame: 1 },
  sm: { w: 38, h: 52, rankFont: 14, symbolFont: 12, iconFont: 7, frame: 1.5 },
  md: { w: 52, h: 72, rankFont: 17, symbolFont: 15, iconFont: 8, frame: 2 },
  lg: { w: 68, h: 96, rankFont: 21, symbolFont: 19, iconFont: 9, frame: 2.5 },
  xl: { w: 84, h: 118, rankFont: 26, symbolFont: 23, iconFont: 11, frame: 3 },
};

const styles = StyleSheet.create({
  outer: {
    position: "relative",
  },
  frame: {
    flex: 1,
    borderRadius: 8,
  },
  face: {
    flex: 1,
    borderRadius: 6,
    padding: 3,
    alignItems: "center",
    justifyContent: "flex-start",
    overflow: "hidden",
    position: "relative",
  },
  watermarkWrap: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },
  top: {
    alignItems: "center",
    gap: 0,
  },
  rank: {
    lineHeight: undefined,
  },
  symbol: {
    lineHeight: undefined,
    marginTop: -2,
  },
  mirrorSymbol: {
    position: "absolute",
    bottom: 2,
    left: 4,
    transform: [{ rotate: "180deg" }],
    opacity: 0.8,
  },
  hasteLock: {
    position: "absolute",
    top: 3,
    right: 3,
  },
  hasteLockText: {},
  costChip: {
    position: "absolute",
    bottom: 3,
    right: 3,
    backgroundColor: "rgba(138,105,20,0.14)",
    borderRadius: 5,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  costChipText: {
    fontFamily: "Inter_700Bold",
    color: "#8a6414",
  },
  costChipUnaffordable: {
    backgroundColor: Tints.crimson,
  },
  costChipTextUnaffordable: {
    color: Colors.suitRed,
  },
  ring: {
    position: "absolute",
    top: -2,
    left: -2,
    right: -2,
    bottom: -2,
    borderRadius: 10,
    borderWidth: 2,
  },
  pulse: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 8,
    borderWidth: 1.5,
  },
});
