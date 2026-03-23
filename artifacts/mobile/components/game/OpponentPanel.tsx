import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { PublicPlayerState } from "@workspace/api-client-react";
import CourtZone from "./CourtZone";
import Colors from "@/constants/colors";

interface OpponentPanelProps {
  player: PublicPlayerState;
  displayName: string;
  isActive: boolean;
  isEliminated?: boolean;
  onRoyalPress?: (royalId: string) => void;
  selectedTargetId?: string | null;
}

export default function OpponentPanel({
  player,
  displayName,
  isActive,
  isEliminated = false,
  onRoyalPress,
  selectedTargetId,
}: OpponentPanelProps) {
  return (
    <View style={[styles.container, isActive && styles.containerActive, isEliminated && styles.containerEliminated]}>
      <View style={[styles.info, isEliminated && styles.infoEliminated]}>
        <View style={styles.nameRow}>
          {isActive && <View style={styles.activeDot} />}
          <Text style={[styles.name, isActive && styles.nameActive, isEliminated && styles.nameEliminated]} numberOfLines={1}>
            {displayName}
          </Text>
        </View>
        {isEliminated ? (
          <View style={styles.eliminatedBadge}>
            <Text style={styles.eliminatedText}>ELIMINATED</Text>
          </View>
        ) : (
          <>
            <View style={styles.stats}>
              <View style={styles.statChip}>
                <Text style={styles.statIcon}>♥</Text>
                <Text style={styles.statVal}>{player.life}</Text>
              </View>
              <View style={styles.statChip}>
                <Text style={styles.statIcon}>🃏</Text>
                <Text style={styles.statVal}>{player.handCount}</Text>
              </View>
              {player.vault.available > 0 && (
                <View style={[styles.statChip, styles.vaultChip]}>
                  <Text style={styles.statIcon}>⚡</Text>
                  <Text style={[styles.statVal, { color: Colors.brand }]}>{player.vault.available}</Text>
                </View>
              )}
            </View>
            {player.mine.length > 0 && (
              <Text style={styles.mineHint}>⛏ {player.mine.length}</Text>
            )}
          </>
        )}
      </View>
      <View style={[styles.court, isEliminated && styles.courtEliminated]}>
        <CourtZone
          court={player.court}
          size="sm"
          onRoyalPress={isEliminated ? undefined : onRoyalPress}
          selectedTargetId={selectedTargetId}
        />
        {isEliminated && player.court.length === 0 && (
          <Text style={styles.emptyEliminated}>No court</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgCard,
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 10,
  },
  containerActive: {
    borderColor: Colors.brand,
    backgroundColor: "rgba(200,155,60,0.06)",
  },
  containerEliminated: {
    opacity: 0.45,
    borderColor: Colors.bgSurface,
  },
  info: {
    width: 100,
    gap: 4,
  },
  nameRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.brand,
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
    flex: 1,
  },
  nameActive: {
    color: Colors.brand,
  },
  stats: {
    flexDirection: "row",
    gap: 4,
    flexWrap: "wrap",
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
    backgroundColor: Colors.bgSurface,
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  vaultChip: {
    backgroundColor: "rgba(200,155,60,0.1)",
  },
  statIcon: {
    fontSize: 9,
  },
  statVal: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textSecondary,
  },
  mineHint: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  court: {
    flex: 1,
  },
  infoEliminated: {
    opacity: 0.7,
  },
  nameEliminated: {
    color: Colors.textMuted,
  },
  courtEliminated: {
    opacity: 0.5,
  },
  eliminatedBadge: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(74,68,56,0.3)",
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderColor: Colors.textMuted,
  },
  eliminatedText: {
    fontSize: 8,
    fontFamily: "Inter_700Bold",
    color: Colors.textMuted,
    letterSpacing: 1,
  },
  emptyEliminated: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
    fontStyle: "italic",
    paddingLeft: 4,
  },
});
