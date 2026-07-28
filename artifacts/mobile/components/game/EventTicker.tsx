import React, { useState } from "react";
import { View, Text, StyleSheet, Pressable, ScrollView, Modal } from "react-native";
import Animated, { FadeIn } from "react-native-reanimated";
import Colors from "@/constants/colors";

/** Structured match-log entry. Simple events use just `text` (+ optional
    `actor`); multi-part outcomes (combat results) add indented `sublines`. */
export interface GameEvent {
  id: number;
  /** Seat color of the player the event is about (grey for neutral events). */
  color: string;
  /** Headline / action text. Card references like "K♠" render as chips. */
  text: string;
  /** Who did it — rendered bold in the seat color before the text. */
  actor?: string;
  /** Indented per-outcome lines under the headline. */
  sublines?: string[];
  /** Small badge before the actor, e.g. "⚡" for off-turn plays or "auto". */
  tag?: string;
  /** Epoch ms when the entry was logged; rendered as HH:MM:SS. */
  at: number;
}

function formatTime(at: number): string {
  const d = new Date(at);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

interface EventTickerProps {
  events: GameEvent[];
}

// Matches card references produced by cardLabel()/royalStatLabel():
// "K♠", "10♥", "JKR★", optionally followed by a stat block "⚔3 ♥3".
// Buffed values show the total with a base+buff breakdown in parentheses and
// damage as a trailing minus term, e.g. "⚔11(2+9) ♥13(2+11)−3". Clubs can push
// totals negative, so each number accepts a leading minus. Both ASCII "-" and
// the minus sign "−" are accepted for the damage term.
const STAT_TERM = String.raw`-?\d+(?:\(-?\d+[+-]\d+\))?(?:[−-]\d+)?`;
const CARD_TOKEN_RE = new RegExp(
  String.raw`((?:10|[AJQK2-9])[♥♠♦♣]|JKR★)(?:\s+(⚔${STAT_TERM})\s+(♥${STAT_TERM}))?`,
  "g",
);

const SUIT_COLORS: Record<string, string> = {
  "♥": "#C8102E",
  "♦": "#1565C0",
  "♣": "#1B5E20",
  "♠": "#1A1A1A",
  "★": "#8A6A1E",
};

/** A compact card badge: mini-card look (light face, suit-colored text),
    with an optional muted stat suffix. */
export function CardChip({ label, stats }: { label: string; stats?: string }) {
  const suit = label[label.length - 1] ?? "";
  const color = SUIT_COLORS[suit] ?? "#1A1A1A";
  return (
    <View style={chipStyles.wrap}>
      <View style={chipStyles.chip}>
        <Text style={[chipStyles.chipText, { color }]}>{label}</Text>
      </View>
      {stats ? <Text style={chipStyles.stats}>{stats}</Text> : null}
    </View>
  );
}

/** Renders a log line, replacing inline card references with CardChips.
    Uses a wrapping row so chips can be real (rounded) views. */
export function RichLine({
  text,
  actor,
  actorColor,
  tag,
  textStyle,
  showStats = true,
}: {
  text: string;
  actor?: string;
  actorColor?: string;
  tag?: string;
  textStyle?: object;
  showStats?: boolean;
}) {
  const parts: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  const pushText = (s: string) => {
    if (!s) return;
    // Split into words so the row can wrap naturally.
    for (const w of s.split(/(\s+)/)) {
      if (w.trim().length === 0) continue;
      parts.push(
        <Text key={`t${key++}`} style={[chipStyles.lineText, textStyle]}>
          {w}
        </Text>,
      );
    }
  };
  CARD_TOKEN_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = CARD_TOKEN_RE.exec(text)) !== null) {
    pushText(text.slice(last, m.index));
    parts.push(
      <CardChip
        key={`c${key++}`}
        label={m[1]!}
        stats={showStats && m[2] ? `${m[2]} ${m[3]}` : undefined}
      />,
    );
    last = m.index + m[0].length;
  }
  pushText(text.slice(last));

  return (
    <View style={chipStyles.lineRow}>
      {tag ? <Text style={chipStyles.tag}>{tag}</Text> : null}
      {actor ? (
        <Text style={[chipStyles.actor, actorColor ? { color: actorColor } : null]}>{actor}</Text>
      ) : null}
      {parts}
    </View>
  );
}

/** Flattens a headline to plain text for the collapsed peek: card references
    keep their label ("K♠") but drop the "⚔3 ♥3" stat block, which is only
    readable next to a real chip. */
function peekText(text: string): string {
  CARD_TOKEN_RE.lastIndex = 0;
  return text.replace(CARD_TOKEN_RE, (_full, card: string) => card);
}

/** Rolling match log: shows the last couple of events inline; tap to expand
    the full history. Replaces the old fade-away combat banner so state
    changes are never missable. */
export default function EventTicker({ events }: EventTickerProps) {
  const [open, setOpen] = useState(false);
  const recent = events.slice(-2).reverse();
  const all = [...events].reverse();

  if (events.length === 0) return null;

  const rows = (list: GameEvent[]) =>
    list.map((ev) => (
      <Animated.View key={ev.id} entering={FadeIn.duration(250)} style={styles.row}>
        <View style={[styles.dot, { backgroundColor: ev.color }]} />
        <Text style={styles.timestamp}>{formatTime(ev.at)}</Text>
        <View style={styles.body}>
          <RichLine text={ev.text} actor={ev.actor} actorColor={ev.color} tag={ev.tag} />
          {ev.sublines?.map((line, j) => (
            <View key={j} style={styles.subline}>
              <RichLine text={line} />
            </View>
          ))}
        </View>
      </Animated.View>
    ));

  return (
    <>
      {/* Collapsed inline peek: the last two headlines, each ONE truncated line.
          It deliberately does not use RichLine/rows(): that renderer is a
          wrapping flex row of word- and chip-Views whose height the parent does
          not reserve, so a headline that wrapped to a second line was drawn on
          top of the entry below it — the "jumbled" log. Fixed-height plain Text
          with numberOfLines={1} cannot collide. Chips, stat blocks and the
          combat sublines all still live in the modal, one tap away. */}
      <Pressable onPress={() => setOpen(true)} style={styles.container}>
        <View style={styles.collapsedList}>
          {recent.map((ev, i) => (
            <View key={ev.id} style={styles.peekRow}>
              <View style={[styles.dot, styles.peekDot, { backgroundColor: ev.color }]} />
              <Text style={styles.timestamp}>{formatTime(ev.at)}</Text>
              <Text
                numberOfLines={1}
                ellipsizeMode="tail"
                style={[styles.peekLine, i === 0 ? styles.textLatest : null]}
              >
                {ev.tag ? <Text style={styles.peekTag}>{ev.tag} </Text> : null}
                {ev.actor ? (
                  <Text style={[styles.peekActor, { color: ev.color }]}>{ev.actor} </Text>
                ) : null}
                {peekText(ev.text)}
              </Text>
            </View>
          ))}
        </View>
        <Text style={styles.expandHint}>{`log (${events.length}) — tap to open`}</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.logOverlay} onPress={() => setOpen(false)}>
          <View style={styles.logSheet}>
            <View style={styles.logHeader}>
              <Text style={styles.logTitle}>Match log · {events.length}</Text>
              <Pressable onPress={() => setOpen(false)} hitSlop={8}>
                <Text style={styles.logClose}>✕</Text>
              </Pressable>
            </View>
            <ScrollView style={styles.logScroll} contentContainerStyle={styles.logScrollContent}>
              {rows(all)}
            </ScrollView>
            <Text style={styles.logDismiss}>Tap outside to close</Text>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const chipStyles = StyleSheet.create({
  lineRow: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    columnGap: 4,
    rowGap: 2,
  },
  lineText: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  actor: {
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_700Bold",
    color: Colors.textSecondary,
  },
  tag: {
    fontSize: 11,
    lineHeight: 18,
    color: "#C89B3C",
  },
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  chip: {
    backgroundColor: "#F3EEE2",
    borderRadius: 4,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.35)",
  },
  chipText: {
    fontSize: 11,
    lineHeight: 14,
    fontFamily: "Inter_700Bold",
  },
  stats: {
    fontSize: 10,
    lineHeight: 14,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
});

/** One collapsed-peek row: 16px of line box plus a little breathing room. */
const PEEK_ROW_HEIGHT = 22;

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    gap: 3,
    maxHeight: 220,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    paddingVertical: 3,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(255,255,255,0.08)",
  },
  body: {
    flex: 1,
    gap: 2,
  },
  subline: {
    flexDirection: "row",
    paddingLeft: 12,
    borderLeftWidth: 2,
    borderLeftColor: "rgba(255,255,255,0.12)",
    marginLeft: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 5,
  },
  timestamp: {
    fontSize: 10,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.35)",
    fontVariant: ["tabular-nums"],
  },
  text: {
    flex: 1,
    fontSize: 13,
    lineHeight: 18,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  textLatest: {
    color: Colors.textSecondary,
    fontFamily: "Inter_600SemiBold",
  },
  expandHint: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
    alignSelf: "flex-end",
  },
  collapsedList: {
    // Two fixed-height single-line rows. The height is now fully determined by
    // PEEK_ROW_HEIGHT rather than by how a headline happens to wrap, so nothing
    // can spill into the panels below. overflow stays as a belt-and-braces clip.
    height: PEEK_ROW_HEIGHT * 2,
    overflow: "hidden",
  },
  peekRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: PEEK_ROW_HEIGHT,
  },
  peekDot: {
    // styles.dot nudges the dot down to meet the first line of a top-aligned
    // multi-line body; the peek is single-line and centered, so undo that.
    marginTop: 0,
  },
  peekLine: {
    flex: 1,
    fontSize: 12,
    lineHeight: 16,
    fontFamily: "Inter_400Regular",
    color: Colors.textMuted,
  },
  // Nested peek Texts deliberately set no lineHeight — inheriting the parent's
  // keeps every row exactly one line tall on Android.
  peekActor: {
    fontSize: 12,
    fontFamily: "Inter_700Bold",
  },
  peekTag: {
    fontSize: 11,
    color: "#C89B3C",
  },
  logOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  logSheet: {
    maxHeight: "75%",
    backgroundColor: Colors.bgDeep,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.08)",
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 20,
  },
  logHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  logTitle: {
    color: Colors.textPrimary,
    fontSize: 15,
    fontWeight: "700",
  },
  logClose: {
    color: Colors.textMuted,
    fontSize: 18,
    paddingHorizontal: 6,
  },
  logScroll: {
    flexGrow: 0,
  },
  logScrollContent: {
    paddingBottom: 8,
  },
  logDismiss: {
    color: Colors.textMuted,
    fontSize: 11,
    textAlign: "center",
    marginTop: 8,
  },
});
