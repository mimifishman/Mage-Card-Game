import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";

export interface GameEvent {
  id: number;
  /** Seat color of the player the event is about (grey for neutral events). */
  color: string;
  text: string;
}

interface EventTickerProps {
  events: GameEvent[];
}

/** Rolling match log: shows the last couple of events inline; tap to expand
    the full history. Replaces the old fade-away combat banner so state
    changes are never missable. */
export default function EventTicker({ events }: EventTickerProps) {
  const [expanded, setExpanded] = useState(false);
  const recent = events.slice(-2).reverse();
  const all = [...events].reverse();

  if (events.length === 0) return null;

  const rows = (list: GameEvent[], latestBold: boolean) =>
    list.map((ev, i) => (
      <Animated.View key={ev.id} entering={FadeIn.duration(250)} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: ev.color }]} />
        <Text style={[styles.text, i === 0 && latestBold && styles.textLatest]} numberOfLines={2}>
          {ev.text}
        </Text>
      </Animated.View>
    ));

  return (
    <Pressable onPress={() => setExpanded((e) => !e)} style={styles.container}>
      {expanded ? (
        <ScrollView style={styles.expandedList} nestedScrollEnabled>
          {rows(all, false)}
        </ScrollView>
      ) : (
        rows(recent, true)
      )}
      <Text style={styles.expandHint}>{expanded ? "tap to collapse" : `log (${events.length})`}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 3,
    maxHeight: 220,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  text: {
    flex: 1,
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  textLatest: {
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    fontSize: 9,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    alignSelf: "flex-end",
  },
  expandedList: {
    maxHeight: 180,
  },
});
