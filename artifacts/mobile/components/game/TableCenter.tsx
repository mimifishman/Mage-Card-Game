import React, { useState } from "react";
import { View, Text, ScrollView, StyleSheet, Pressable, Modal } from "react-native";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface TableCenterProps {
  mine: string[];
  abyss: string[];
  deckCount: number;
}

/** Slim shared-table strip: deck count, my Mine (vault source) and the Abyss.
    Tapping the Abyss opens a browsable view of the whole discard pile. */
export default function TableCenter({ mine, abyss, deckCount }: TableCenterProps) {
  const [showAbyss, setShowAbyss] = useState(false);
  const topAbyss = abyss.length > 0 ? abyss[abyss.length - 1] : null;
  const mineValue = mine.reduce((sum, id) => sum + parseCardId(id).pipValue, 0);

  return (
    <View style={styles.container}>
      <View style={styles.zone}>
        <Text style={styles.zoneLabel}>DECK</Text>
        <View style={styles.deckPill}>
          <Text style={styles.deckCount}>{deckCount}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={[styles.zone, styles.mineZone]}>
        <View style={styles.labelRow}>
          <Text style={styles.zoneLabel}>MINE</Text>
          <View style={styles.mineBadge}>
            <Text style={styles.mineBadgeText}>⚡{mineValue}</Text>
          </View>
        </View>
        {mine.length === 0 ? (
          <Text style={styles.zoneEmpty}>—</Text>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.mineScroll}
          >
            {mine.map((cardId, i) => (
              <CardView key={`${cardId}-${i}`} cardId={cardId} size="xs" />
            ))}
          </ScrollView>
        )}
      </View>

      <View style={styles.divider} />

      <Pressable
        onPress={() => abyss.length > 0 && setShowAbyss(true)}
        style={({ pressed }) => [styles.zone, pressed && abyss.length > 0 && { opacity: 0.7 }]}
      >
        <Text style={styles.zoneLabel}>ABYSS · {abyss.length}</Text>
        {topAbyss ? <CardView cardId={topAbyss} size="xs" /> : <Text style={styles.zoneEmpty}>—</Text>}
      </Pressable>

      <Modal visible={showAbyss} transparent animationType="fade" onRequestClose={() => setShowAbyss(false)}>
        <Pressable style={styles.abyssOverlay} onPress={() => setShowAbyss(false)}>
          <View style={styles.abyssSheet}>
            <Text style={styles.abyssTitle}>The Abyss — {abyss.length} cards (newest last)</Text>
            <ScrollView contentContainerStyle={styles.abyssGrid}>
              {abyss.map((cardId, i) => (
                <CardView key={`${cardId}-${i}`} cardId={cardId} size="sm" />
              ))}
            </ScrollView>
            <Text style={styles.abyssHint}>Tap anywhere to close</Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: Colors.bgZoneDeep,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  zone: {
    alignItems: "center",
    gap: 3,
    paddingHorizontal: 6,
  },
  mineZone: {
    flex: 1,
  },
  labelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  zoneLabel: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 1.5,
  },
  zoneEmpty: {
    fontSize: 14,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  deckPill: {
    minWidth: 34,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
  },
  deckCount: {
    fontSize: 15,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  mineBadge: {
    backgroundColor: "rgba(27,94,32,0.4)",
    borderRadius: 6,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderWidth: 1,
    borderColor: "rgba(46,125,50,0.6)",
  },
  mineBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#FFFFFF",
  },
  mineScroll: {
    gap: 3,
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: Colors.border,
    marginHorizontal: 4,
  },
  abyssOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    justifyContent: "center",
    padding: 24,
  },
  abyssSheet: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    padding: 16,
    maxHeight: "70%",
    gap: 12,
  },
  abyssTitle: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  abyssGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  abyssHint: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    textAlign: "center",
  },
});
