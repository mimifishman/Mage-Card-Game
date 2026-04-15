import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface MineAbyssRowProps {
  mine: string[];
  abyss: string[];
  deckCount: number;
}

export default function MineAbyssRow({ mine, abyss, deckCount }: MineAbyssRowProps) {
  const topAbyss = abyss.length > 0 ? abyss[abyss.length - 1] : null;
  const mineValue = mine.reduce((sum, id) => sum + parseCardId(id).pipValue, 0);

  return (
    <View style={styles.container}>
      <View style={[styles.zone, styles.mineZone]}>
        <View style={styles.mineLabelRow}>
          <Text style={styles.zoneLabel}>MINE</Text>
          <View style={styles.mineBadge}>
            <Text style={styles.mineBadgeText}>{mineValue}</Text>
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
              <CardView key={`${cardId}-${i}`} cardId={cardId} size="sm" />
            ))}
          </ScrollView>
        )}
        <Text style={styles.zoneSub}>pts value</Text>
      </View>

      <View style={styles.divider} />

      <View style={[styles.zone, styles.abyssZone]}>
        <Text style={styles.zoneLabel}>ABYSS</Text>
        {topAbyss ? (
          <CardView cardId={topAbyss} size="sm" />
        ) : (
          <Text style={styles.zoneEmpty}>—</Text>
        )}
        <Text style={styles.zoneSub}>{abyss.length} cards</Text>
      </View>

      <View style={styles.divider} />

      <View style={[styles.zone, styles.deckZone]}>
        <Text style={styles.zoneLabel}>DECK</Text>
        <View style={styles.deckIcon}>
          <Text style={styles.deckCount}>{deckCount}</Text>
        </View>
        <Text style={styles.zoneSub}>remaining</Text>
      </View>
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
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 0,
  },
  zone: {
    flex: 1,
    alignItems: "center",
    gap: 4,
    paddingVertical: 4,
    borderRadius: 8,
  },
  mineZone: {
    backgroundColor: "rgba(27,94,32,0.12)",
  },
  abyssZone: {
    backgroundColor: "rgba(200,16,46,0.08)",
  },
  deckZone: {
    backgroundColor: "rgba(200,155,60,0.08)",
  },
  zoneLabel: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
    letterSpacing: 2,
    textTransform: "uppercase",
  },
  zoneEmpty: {
    fontSize: 18,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  zoneSub: {
    fontSize: 9,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  mineLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  mineBadge: {
    backgroundColor: "rgba(27,94,32,0.25)",
    borderRadius: 8,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  mineBadgeText: {
    fontSize: 11,
    fontFamily: "Inter_700Bold",
    color: "#1B5E20",
  },
  mineScroll: {
    gap: 3,
  },
  divider: {
    width: 1,
    height: 56,
    backgroundColor: Colors.border,
    marginHorizontal: 6,
  },
  deckIcon: {
    width: 38,
    height: 52,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  deckCount: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
});
