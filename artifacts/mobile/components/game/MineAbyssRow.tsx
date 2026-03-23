import React from "react";
import { View, Text, ScrollView, StyleSheet } from "react-native";
import CardView from "./CardView";
import Colors from "@/constants/colors";

interface MineAbyssRowProps {
  mine: string[];
  abyss: string[];
  deckCount: number;
}

export default function MineAbyssRow({ mine, abyss, deckCount }: MineAbyssRowProps) {
  const topAbyss = abyss.length > 0 ? abyss[abyss.length - 1] : null;

  return (
    <View style={styles.container}>
      <View style={styles.zone}>
        <Text style={styles.zoneLabel}>MINE</Text>
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
        <Text style={styles.zoneSub}>{mine.length} diamonds</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.zone}>
        <Text style={styles.zoneLabel}>ABYSS</Text>
        {topAbyss ? (
          <CardView cardId={topAbyss} size="sm" />
        ) : (
          <Text style={styles.zoneEmpty}>—</Text>
        )}
        <Text style={styles.zoneSub}>{abyss.length} cards</Text>
      </View>

      <View style={styles.divider} />

      <View style={styles.zone}>
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
    backgroundColor: Colors.bgSurface,
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
  },
  zoneLabel: {
    fontSize: 8,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textMuted,
    letterSpacing: 1.5,
  },
  zoneEmpty: {
    fontSize: 18,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  zoneSub: {
    fontSize: 8,
    color: Colors.textMuted,
    fontFamily: "Inter_400Regular",
  },
  mineScroll: {
    gap: 3,
  },
  divider: {
    width: 1,
    height: 48,
    backgroundColor: Colors.border,
    marginHorizontal: 8,
  },
  deckIcon: {
    width: 38,
    height: 52,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.bgCard,
    alignItems: "center",
    justifyContent: "center",
  },
  deckCount: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
});
