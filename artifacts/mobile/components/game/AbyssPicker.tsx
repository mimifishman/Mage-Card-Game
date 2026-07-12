import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import CardView from "./CardView";
import Colors from "@/constants/colors";
import { parseCardId } from "@/lib/gameUtils";

interface AbyssPickerProps {
  abyss: string[];
  /** Only cards with pip value ≤ this can be retrieved. */
  maxValue: number;
  onPick: (cardId: string) => void;
  onClose: () => void;
}

/** Inline picker for "discard Spade → return a card from the Abyss".
    Sits above the hand; the board stays visible. */
export default function AbyssPicker({ abyss, maxValue, onPick, onClose }: AbyssPickerProps) {
  const eligible = abyss.filter((c) => parseCardId(c).pipValue <= maxValue);

  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Take back a card from the Abyss (value ≤ {maxValue})</Text>
        <Pressable onPress={onClose} hitSlop={10}>
          <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
        </Pressable>
      </View>
      {eligible.length === 0 ? (
        <Text style={styles.empty}>Nothing in the Abyss is weak enough (needs value ≤ {maxValue}).</Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {eligible.map((cardId, i) => (
            <Pressable
              key={`${cardId}-${i}`}
              onPress={() => onPick(cardId)}
              style={({ pressed }) => [pressed && { opacity: 0.7 }]}
            >
              <CardView cardId={cardId} size="md" />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  empty: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    paddingVertical: 8,
  },
  row: {
    gap: 8,
  },
});
