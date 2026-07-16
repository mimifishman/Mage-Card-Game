import type { TextStyle, ViewStyle } from "react-native";
import Colors from "./colors";

// ── Wizard's Sanctum theme primitives ────────────────────────────────────
// Everything visual that isn't a flat color lives here: gradient ramps,
// glow/shadow presets, translucent tints, radii, spacing and the typography
// scale. Components should compose these instead of hardcoding hex/rgba.

/** Gradient color ramps for expo-linear-gradient (top → bottom). */
export const Gradients = {
  /** The sanctum itself — every screen's backdrop. */
  sanctum: ["#080810", "#12122A", "#080810"] as const,
  /** Loading / error states: darker, no indigo lift. */
  sanctumDeep: ["#050508", "#0C0C1C"] as const,
  /** Stone panel surfaces (seats, sheets, cards-on-dark). */
  panel: ["#181836", "#101024"] as const,
  /** Slightly raised panel (modals, focused elements). */
  panelRaised: ["#1E1E42", "#12122A"] as const,
  /** Gold filigree CTA. */
  gold: [Colors.brand, Colors.brandDim] as const,
  /** Positive action (rematch, confirm). */
  green: [Colors.accentGreen, "#1E8449"] as const,
  /** Arcane violet (rune accents, special states). */
  arcane: [Colors.arcane, Colors.arcaneDim] as const,
  /** Card frame metals. */
  goldFrame: ["#E8C878", Colors.brand, "#7A5C10"] as const,
};

/** Soft colored glows (iOS shadow* + Android elevation). */
export const Glows: Record<string, ViewStyle> = {
  gold: {
    shadowColor: Colors.brand,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  arcane: {
    shadowColor: Colors.arcane,
    shadowOpacity: 0.5,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  soft: {
    shadowColor: "#000000",
    shadowOpacity: 0.4,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
};

/** Translucent tints for chips, badges and highlights. */
export const Tints = {
  gold: "rgba(200,155,60,0.14)",
  goldStrong: "rgba(200,155,60,0.30)",
  goldBorder: "rgba(200,155,60,0.55)",
  red: "rgba(229,57,53,0.14)",
  redBorder: "rgba(229,57,53,0.6)",
  crimson: "rgba(200,16,46,0.14)",
  crimsonBorder: "rgba(200,16,46,0.4)",
  life: "rgba(255,107,107,0.12)",
  green: "rgba(46,125,50,0.28)",
  greenBorder: "rgba(102,187,106,0.55)",
  arcane: "rgba(124,108,240,0.14)",
  arcaneBorder: "rgba(124,108,240,0.45)",
  white: "rgba(255,255,255,0.06)",
  whiteFaint: "rgba(255,255,255,0.04)",
  obsidian: "rgba(8,8,16,0.6)",
  /** Near-opaque stone panel over the board (duel stage, sheets). */
  obsidianPanel: "rgba(10,10,24,0.92)",
  /** Faint translucent panel fill (empty slots, subdued rows). */
  panelFaint: "rgba(24,24,54,0.5)",
  greenFaint: "rgba(46,125,50,0.10)",
  azure: "rgba(21,101,192,0.25)",
};

export const Radii = { xs: 4, sm: 6, md: 10, lg: 14, xl: 20, pill: 999 };

export const Spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };

// ── Typography ───────────────────────────────────────────────────────────
// display  → Cinzel Decorative: the MAGE wordmark, victory titles, Royal ranks
// heading  → Cinzel: screen/panel headings, phase labels
// body     → Inter: prose, hints, chips
// numeral  → Inter Bold: life/vault/stats — decorative faces read poorly on
//            small, fast-changing numbers, so numerals stay Inter.
export const Type: Record<string, TextStyle> = {
  display: { fontFamily: "CinzelDecorative_700Bold" },
  heading: { fontFamily: "Cinzel_700Bold" },
  headingMedium: { fontFamily: "Cinzel_600SemiBold" },
  body: { fontFamily: "Inter_400Regular" },
  bodyMedium: { fontFamily: "Inter_500Medium" },
  bodySemiBold: { fontFamily: "Inter_600SemiBold" },
  bodyBold: { fontFamily: "Inter_700Bold" },
  numeral: { fontFamily: "Inter_700Bold" },
};
