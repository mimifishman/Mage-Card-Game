import React from "react";
import { View, Text, Pressable, StyleSheet, ScrollView } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import Colors from "@/constants/colors";
import CardView from "./CardView";
import { parseCardId } from "@/lib/gameUtils";
import type { ValidAction } from "@/lib/gameUtils";

interface ActionDockProps {
  cardId: string;
  /** Actions that are buttons (no board target): play royal, mine, draw, abyss return… */
  chipActions: ValidAction[];
  /** One-line hints for board-targeted plays ("tap a Royal to +3 HP"). */
  targetHints: string[];
  /** Nothing can be done with this card right now — explain why instead. */
  blockedReason?: string | null;
  onChipPress: (action: ValidAction) => void;
  onClose: () => void;
}

/** Compact dock pinned above the hand while a card is selected. The board
    stays fully visible — targeted plays happen by tapping the glowing target
    on the board itself; only target-less actions appear here as chips. */
export default function ActionDock({
  cardId,
  chipActions,
  targetHints,
  blockedReason,
  onChipPress,
  onClose,
}: ActionDockProps) {
  const card = parseCardId(cardId);

  return (
    <Animated.View entering={FadeInDown.duration(180)} style={styles.container}>
      <View style={styles.left}>
        <CardView cardId={cardId} size="sm" />
      </View>

      <View style={styles.body}>
        <Text style={styles.title}>
          {card.displayRank}{card.suitSymbol}
          {card.vaultCost > 0 && <Text style={styles.cost}>  ⚡{card.vaultCost}</Text>}
        </Text>

        {blockedReason ? (
          <Text style={styles.blocked}>{blockedReason}</Text>
        ) : (
          <>
            {targetHints.map((h) => (
              <Text key={h} style={styles.hint}>
                <Ionicons name="locate" size={11} color={Colors.brand} /> {h}
              </Text>
            ))}
            {chipActions.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.chipRow}
              >
                {chipActions.map((a, i) => {
                  // Icon tile when the action provides icon+short; otherwise a
                  // clean wrapped text tile — never a horizontal run-on.
                  const isTile = !!a.icon && !!a.short;
                  return (
                    <Pressable
                      key={`${a.action}-${i}`}
                      onPress={() => !a.disabled && onChipPress(a)}
                      disabled={a.disabled}
                      style={({ pressed }) => [
                        isTile ? styles.tile : styles.textChip,
                        a.disabled && styles.chipDisabled,
                        pressed && !a.disabled && { opacity: 0.75 },
                      ]}
                    >
                      {isTile ? (
                        <>
                          <Text style={[styles.tileIcon, a.disabled && styles.dim]}>{a.icon}</Text>
                          <Text style={[styles.tileShort, a.disabled && styles.chipTextDisabled]}>
                            {a.short}
                          </Text>
                          {a.detail && (
                            <Text style={[styles.tileDetail, a.disabled && styles.chipTextDisabled]}>
                              {a.detail}
                            </Text>
                          )}
                        </>
                      ) : (
                        <Text style={[styles.chipText, a.disabled && styles.chipTextDisabled]}>
                          {a.label}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </>
        )}
      </View>

      <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
        <Ionicons name="close-circle" size={22} color={Colors.textMuted} />
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: Colors.bgCard,
    borderTopWidth: 1,
    borderTopColor: Colors.brand,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  left: {},
  body: {
    flex: 1,
    gap: 5,
  },
  title: {
    fontSize: 14,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  cost: {
    fontSize: 12,
    color: Colors.brand,
  },
  hint: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
  },
  blocked: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    color: "#E8A0A8",
  },
  chipRow: {
    gap: 8,
    alignItems: "stretch",
  },
  tile: {
    width: 86,
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 6,
    alignItems: "center",
    justifyContent: "center",
    gap: 1,
  },
  tileIcon: {
    fontSize: 20,
  },
  tileShort: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
    color: Colors.textPrimary,
  },
  tileDetail: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    color: Colors.brand,
  },
  dim: {
    opacity: 0.5,
  },
  textChip: {
    maxWidth: 150,
    justifyContent: "center",
    backgroundColor: Colors.bgSurface,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  chipDisabled: {
    opacity: 0.55,
    borderColor: "transparent",
  },
  chipText: {
    fontSize: 12,
    fontFamily: "Inter_600SemiBold",
    color: Colors.textPrimary,
  },
  chipTextDisabled: {
    color: Colors.textMuted,
  },
  closeBtn: {
    alignSelf: "flex-start",
  },
});
