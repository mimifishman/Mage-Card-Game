import React, { useEffect, useRef, useState } from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import Animated, { FadeOut, FadeInUp } from "react-native-reanimated";
import type { PublicPlayerState } from "@workspace/api-client-react";
import CourtZone from "./CourtZone";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface SeatProps {
  player: PublicPlayerState;
  displayName: string;
  /** Fixed accent color for this player for the whole match. */
  color: string;
  isMe?: boolean;
  /** The game is currently waiting on this player — bright ring + status chip. */
  isTurnHolder?: boolean;
  /** Why the game is waiting on them: PLAYING / BLOCKING / DUELING / RESPONDING. */
  statusChip?: string | null;
  isEliminated?: boolean;
  /** Narrow profile mode used for unfocused seats in 4-player games. */
  compact?: boolean;
  /** Tap-to-focus for compact seats. */
  onFocusPress?: () => void;
  courtSize?: "sm" | "md" | "lg" | "xl";
  onRoyalPress?: (royalId: string) => void;
  /** Legal royal targets for the selected card (seat-colored glow). */
  royalGlowIds?: Set<string>;
  glowColor?: string;
  highlightedIds?: Set<string>;
  dimmedIds?: Set<string>;
  highlightBadgeText?: string;
  selectedTargetId?: string | null;
  /** This player is a legal target for the selected card — crest glows. */
  crestTargetable?: boolean;
  crestTargetHint?: string;
  onCrestPress?: () => void;
  /** Cards this player is attacking me with (shown as a red badge). */
  attackingYouWith?: string[];
  phase?: string;
  isDefender?: boolean;
}

export default function Seat({
  player,
  displayName,
  color,
  isMe = false,
  isTurnHolder = false,
  statusChip,
  isEliminated = false,
  compact = false,
  onFocusPress,
  courtSize = "md",
  onRoyalPress,
  royalGlowIds,
  glowColor,
  highlightedIds,
  dimmedIds,
  highlightBadgeText,
  selectedTargetId,
  crestTargetable = false,
  crestTargetHint,
  onCrestPress,
  attackingYouWith,
  phase,
  isDefender,
}: SeatProps) {
  // Life-change floater: when life changes, float a ±N over the heart stat.
  const prevLifeRef = useRef(player.life);
  const [lifeDelta, setLifeDelta] = useState<number | null>(null);
  useEffect(() => {
    const prev = prevLifeRef.current;
    if (player.life !== prev) {
      setLifeDelta(player.life - prev);
      prevLifeRef.current = player.life;
      const t = setTimeout(() => setLifeDelta(null), 1600);
      return () => clearTimeout(t);
    }
    prevLifeRef.current = player.life;
  }, [player.life]);

  const showAttacking = !!attackingYouWith && attackingYouWith.length > 0;

  const crest = (
    <Pressable
      onPress={crestTargetable ? onCrestPress : compact ? onFocusPress : undefined}
      disabled={!crestTargetable && !(compact && onFocusPress)}
      style={({ pressed }) => [
        styles.crestRow,
        crestTargetable && [styles.crestTargetable, { borderColor: color }],
        pressed && (crestTargetable || (compact && onFocusPress)) && { opacity: 0.7 },
      ]}
    >
      <View style={[styles.avatar, { borderColor: color }, isEliminated && styles.avatarEliminated]}>
        <Text style={styles.avatarText}>{(displayName || "?").slice(0, 1).toUpperCase()}</Text>
      </View>
      <View style={styles.nameCol}>
        <Text
          style={[
            styles.name,
            { color: isEliminated ? Colors.textMuted : color },
            isTurnHolder && styles.nameActive,
          ]}
          numberOfLines={1}
        >
          {isMe ? `${displayName} (You)` : displayName}
        </Text>
        {isEliminated ? (
          <Text style={styles.eliminatedText}>ELIMINATED</Text>
        ) : statusChip ? (
          <View style={[styles.statusChip, { backgroundColor: color }]}>
            <Text style={styles.statusChipText}>{statusChip}</Text>
          </View>
        ) : null}
      </View>
      {crestTargetable && (
        <View style={[styles.crestHint, { backgroundColor: color }]}>
          <Text style={styles.crestHintText}>{crestTargetHint ?? "TAP"}</Text>
        </View>
      )}
    </Pressable>
  );

  const stats = !isEliminated && (
    <View style={[styles.statsRow, compact && styles.statsRowCompact]}>
      {/* Prominent: Life + Vault — the two numbers that decide every choice. */}
      <View style={[styles.statPrimary, styles.statLife, compact && styles.statPrimaryCompact]}>
        <Text style={[styles.statPrimaryIcon, compact && styles.statPrimaryIconCompact]}>❤️</Text>
        <Text style={[styles.statPrimaryValue, compact && styles.statPrimaryValueCompact, { color: "#FF6B6B" }]}>
          {player.life}
        </Text>
        {lifeDelta !== null && (
          <Animated.Text
            entering={FadeInUp.duration(250)}
            exiting={FadeOut.duration(300)}
            style={[
              styles.lifeDelta,
              { color: lifeDelta > 0 ? "#58C878" : "#FF5252" },
            ]}
          >
            {lifeDelta > 0 ? `+${lifeDelta}` : `${lifeDelta}`}
          </Animated.Text>
        )}
      </View>
      <View style={[styles.statPrimary, styles.statVault, compact && styles.statPrimaryCompact]}>
        <Text style={[styles.statPrimaryIcon, compact && styles.statPrimaryIconCompact]}>⚡</Text>
        <Text style={[styles.statPrimaryValue, compact && styles.statPrimaryValueCompact, { color: Colors.brand }]}>
          {player.vault.available}
        </Text>
      </View>

      {/* Secondary: Hand + Court, shown as counts (×N) so the icons read clearly. */}
      <View style={styles.statSecondaryGroup}>
        <View style={styles.statSecondary}>
          <Text style={[styles.statSecondaryIcon, compact && styles.statSecondaryIconCompact]}>🂠</Text>
          <Text style={[styles.statSecondaryValue, compact && styles.statSecondaryValueCompact]}>×{player.handCount}</Text>
        </View>
        <View style={styles.statSecondary}>
          <Text style={[styles.statSecondaryIcon, compact && styles.statSecondaryIconCompact]}>👑</Text>
          <Text style={[styles.statSecondaryValue, compact && styles.statSecondaryValueCompact]}>×{player.court.length}</Text>
        </View>
      </View>
    </View>
  );

  if (compact) {
    return (
      <Pressable
        onPress={onFocusPress}
        disabled={!onFocusPress}
        style={({ pressed }) => [
          styles.container,
          styles.containerCompact,
          { borderColor: isTurnHolder ? color : Colors.border },
          isTurnHolder && [styles.containerTurn, { shadowColor: color }],
          isEliminated && styles.containerEliminated,
          pressed && onFocusPress && { opacity: 0.8 },
        ]}
      >
        {crest}
        {stats}
        {showAttacking && (
          <View style={styles.attackingBadge}>
            <Text style={styles.attackingBadgeTitle}>⚔ ATTACKING YOU</Text>
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View
      style={[
        styles.container,
        { borderColor: isTurnHolder ? color : Colors.border },
        isTurnHolder && [styles.containerTurn, { shadowColor: color }],
        !isTurnHolder && !isMe && styles.containerIdle,
        isEliminated && styles.containerEliminated,
      ]}
    >
      <View style={styles.headerRow}>
        {crest}
        {stats}
      </View>

      {showAttacking && (
        <View style={styles.attackingBadge}>
          <Text style={styles.attackingBadgeTitle}>
            ⚔ ATTACKING YOU:{" "}
            {attackingYouWith!
              .map((id) => {
                const c = parseCardId(id);
                return `${c.displayRank}${c.suitSymbol}`;
              })
              .join("  ")}
          </Text>
        </View>
      )}

      {!isEliminated && (
        <CourtZone
          court={player.court}
          size={courtSize}
          isMyZone={isMe}
          phase={phase}
          isDefender={isDefender}
          onRoyalPress={onRoyalPress}
          selectedTargetId={selectedTargetId}
          highlightedIds={highlightedIds}
          dimmedIds={dimmedIds}
          highlightBadgeText={highlightBadgeText}
          glowIds={royalGlowIds}
          glowColor={glowColor ?? color}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 2,
    gap: 8,
    flexShrink: 1,
  },
  containerCompact: {
    flex: 1,
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  containerTurn: {
    shadowOpacity: 0.8,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
    backgroundColor: "rgba(26,56,36,0.85)",
  },
  containerIdle: {
    opacity: 0.82,
  },
  containerEliminated: {
    opacity: 0.45,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    flexWrap: "wrap",
  },
  crestRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
    minWidth: 0,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  crestTargetable: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  avatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: Colors.bgSurface,
  },
  avatarEliminated: {
    borderColor: Colors.textMuted,
  },
  avatarText: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  nameCol: {
    gap: 2,
    flexShrink: 1,
    minWidth: 0,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
  },
  nameActive: {
    fontFamily: "Inter_700Bold",
  },
  statusChip: {
    alignSelf: "flex-start",
    borderRadius: 5,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  statusChipText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#0A1F13",
    letterSpacing: 1,
  },
  eliminatedText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  crestHint: {
    borderRadius: 6,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  crestHintText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: "#0A1F13",
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    flexShrink: 0,
  },
  statsRowCompact: {
    gap: 6,
    flexWrap: "wrap",
  },
  statPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 9,
  },
  statPrimaryCompact: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  statLife: {
    backgroundColor: "rgba(255,107,107,0.12)",
  },
  statVault: {
    backgroundColor: "rgba(200,155,60,0.14)",
  },
  statPrimaryIcon: {
    fontSize: 15,
  },
  statPrimaryIconCompact: {
    fontSize: 12,
  },
  statPrimaryValue: {
    fontSize: 21,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  statPrimaryValueCompact: {
    fontSize: 16,
  },
  statSecondaryGroup: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginLeft: 2,
  },
  statSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  statSecondaryIcon: {
    fontSize: 12,
  },
  statSecondaryIconCompact: {
    fontSize: 10,
  },
  statSecondaryValue: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
  },
  statSecondaryValueCompact: {
    fontSize: 11,
  },
  lifeDelta: {
    position: "absolute",
    top: -14,
    right: -4,
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  attackingBadge: {
    backgroundColor: "rgba(200,16,46,0.14)",
    borderWidth: 1,
    borderColor: "rgba(229,57,53,0.6)",
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: "flex-start",
  },
  attackingBadgeTitle: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
    letterSpacing: 0.5,
  },
});
