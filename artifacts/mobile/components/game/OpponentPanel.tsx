import React from "react";
import { View, Text, StyleSheet, Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import type { PublicPlayerState } from "@workspace/api-client-react";
import CourtZone from "./CourtZone";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface OpponentPanelProps {
  player: PublicPlayerState;
  displayName: string;
  isActive: boolean;
  isEliminated?: boolean;
  onRoyalPress?: (royalId: string) => void;
  selectedTargetId?: string | null;
  attackingYouWith?: string[];
  duelingIds?: Set<string>;
  /** Card size for the opponent's court — shrinks in 4-player games. */
  courtCardSize?: "sm" | "md";
  /** Whether the full court is shown; when false a compact preview strip is used. */
  expanded?: boolean;
  onToggleExpand?: () => void;
}

const PREVIEW_MAX = 6;

export default function OpponentPanel({
  player,
  displayName,
  isActive,
  isEliminated = false,
  onRoyalPress,
  selectedTargetId,
  attackingYouWith,
  duelingIds,
  courtCardSize = "md",
  expanded = true,
  onToggleExpand,
}: OpponentPanelProps) {
  const courtCount = player.court.length;
  const previewCourt = player.court.slice(0, PREVIEW_MAX);
  const previewOverflow = courtCount - previewCourt.length;
  const showAttacking = !!attackingYouWith && attackingYouWith.length > 0;

  return (
    <View style={[
      styles.container,
      isActive && styles.containerActive,
      isEliminated && styles.containerEliminated,
    ]}>
      <Pressable
        onPress={onToggleExpand}
        disabled={!onToggleExpand}
        style={({ pressed }) => [
          styles.headerRow,
          pressed && onToggleExpand && { opacity: 0.7 },
        ]}
      >
        <View style={styles.nameRow}>
          {isActive && <View style={styles.activeDot} />}
          <Text
            style={[
              styles.name,
              isActive && styles.nameActive,
              isEliminated && styles.nameEliminated,
            ]}
            numberOfLines={1}
          >
            {displayName}
          </Text>
        </View>

        {isEliminated ? (
          <View style={styles.eliminatedBadge}>
            <Text style={styles.eliminatedText}>ELIMINATED</Text>
          </View>
        ) : (
          <View style={styles.stats}>
            <View style={[styles.statChip, styles.lifeChip]}>
              <Text style={styles.statIcon}>♥</Text>
              <Text style={[styles.statVal, styles.lifeVal]}>{player.life}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statIcon}>🃏</Text>
              <Text style={styles.statVal}>{player.handCount}</Text>
            </View>
            <View style={[styles.statChip, styles.vaultChip]}>
              <Text style={styles.statIcon}>⚡</Text>
              <Text style={[styles.statVal, { color: Colors.brand }]}>{player.vault.available}</Text>
            </View>
            <View style={styles.statChip}>
              <Text style={styles.statIcon}>👑</Text>
              <Text style={styles.statVal}>{courtCount}</Text>
            </View>
          </View>
        )}

        {onToggleExpand && !isEliminated && (
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={Colors.textMuted}
          />
        )}
      </Pressable>

      {showAttacking && (
        <View style={styles.attackingBadge}>
          <Text style={styles.attackingBadgeTitle}>⚔ ATTACKING YOU</Text>
          {attackingYouWith!.map((cardId) => {
            const card = parseCardId(cardId);
            return (
              <Text key={cardId} style={styles.attackingBadgeCard}>
                <Text style={{ color: card.suitColor === "#0D0D0D" ? Colors.textPrimary : card.suitColor }}>
                  {card.displayRank}{card.suitSymbol}
                </Text>
                {" "}({card.pipValue} dmg)
              </Text>
            );
          })}
        </View>
      )}

      {!isEliminated && expanded && (
        <View style={styles.court}>
          <CourtZone
            court={player.court}
            size={courtCardSize}
            onRoyalPress={onRoyalPress}
            selectedTargetId={selectedTargetId}
            highlightedIds={duelingIds}
            highlightBadgeText={duelingIds && duelingIds.size > 0 ? "⚔ DUEL" : undefined}
          />
        </View>
      )}

      {!isEliminated && !expanded && courtCount > 0 && (
        <View style={styles.previewRow}>
          {previewCourt.map((royal) => (
            <CardView key={royal.cardId} cardId={royal.cardId} size="xs" />
          ))}
          {previewOverflow > 0 && (
            <Text style={styles.previewOverflow}>+{previewOverflow}</Text>
          )}
        </View>
      )}

      {isEliminated && courtCount === 0 && (
        <Text style={styles.emptyEliminated}>No court</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderWidth: 1.5,
    borderColor: Colors.border,
    gap: 8,
  },
  containerActive: {
    borderColor: Colors.brand,
    borderWidth: 2,
    backgroundColor: "rgba(200,155,60,0.08)",
    elevation: 6,
  },
  containerEliminated: {
    opacity: 0.5,
    borderColor: Colors.border,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 32,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flex: 1,
    minWidth: 0,
  },
  activeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.brand,
    elevation: 4,
  },
  name: {
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    flexShrink: 1,
  },
  nameActive: {
    color: Colors.textPrimary,
    fontFamily: "Inter_700Bold",
  },
  nameEliminated: {
    color: Colors.textMuted,
  },
  stats: {
    flexDirection: "row",
    gap: 4,
    flexShrink: 0,
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: Colors.bgSurface,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  lifeChip: {
    borderColor: "rgba(200,16,46,0.4)",
    backgroundColor: "rgba(200,16,46,0.1)",
  },
  vaultChip: {
    backgroundColor: "rgba(200,155,60,0.12)",
    borderColor: "rgba(200,155,60,0.4)",
  },
  statIcon: {
    fontSize: 10,
  },
  statVal: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  lifeVal: {
    color: Colors.accentRed,
  },
  court: {},
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  previewOverflow: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    marginLeft: 2,
  },
  eliminatedBadge: {
    backgroundColor: "rgba(74,68,56,0.4)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  eliminatedText: {
    fontSize: 9,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1.2,
  },
  attackingBadge: {
    backgroundColor: "rgba(200,16,46,0.12)",
    borderWidth: 1,
    borderColor: "rgba(200,16,46,0.5)",
    borderRadius: 8,
    paddingVertical: 5,
    paddingHorizontal: 8,
    gap: 2,
    alignSelf: "flex-start",
  },
  attackingBadgeTitle: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.accentRed,
    letterSpacing: 0.8,
  },
  attackingBadgeCard: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  emptyEliminated: {
    fontSize: 10,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    paddingLeft: 4,
  },
});
