// ── Wizard's Sanctum palette ─────────────────────────────────────────────
// Arcane obsidian & runes: deep space-black/indigo stone lit by gem-colored
// light and gold filigree. Cards stay warm parchment relics so they read as
// the brightest objects on the board. Token KEYS are stable — components
// theme themselves entirely off this file plus constants/theme.ts.
const BRAND = "#C89B3C"; // gold filigree
const BRAND_DIM = "#8B6914";
const BG_OBSIDIAN = "#080810"; // deepest backdrop
const BG_CARD_FACE = "#F8F4E9"; // parchment card face
const BG_ZONE_DEEP = "#0A0A1A";
const BG_ZONE_MID = "#101024"; // indigo stone panel
const BG_ZONE_SURFACE = "#181836";
const BG_HAND_TRAY = "#0C0C20";
const TEXT_PRIMARY = "#F0E6C8"; // warm parchment
const TEXT_SECONDARY = "#C8B88A";
const TEXT_MUTED = "#8B8BB8"; // cool violet-grey
const TEXT_ON_CARD = "#1A1208";
const SUIT_RED = "#C8102E";
const SUIT_BLUE = "#1565C0";
const SUIT_GREEN = "#1B5E20";
const SUIT_INK = "#0D0D0D";
const ACCENT_RED = "#E53935";
const ACCENT_RED_SOFT = "#FF8A8A"; // readable red text on dark panels
const ACCENT_BLUE = "#1976D2";
const ACCENT_GREEN = "#2E7D32";
const ACCENT_GREEN_SOFT = "#8FDF9A"; // readable green text on dark panels
const ARCANE = "#7C6CF0"; // rune-glow violet
const ARCANE_DIM = "#4A3FA0";
const BORDER = "#26264E"; // indigo stone edge
const BORDER_LIGHT = "#3A3A72";

// Per-seat accent colors, assigned by turn order for the whole match.
// Used on seat borders, name tags, attack arrows and event-ticker entries so
// "who did that?" is always answerable by color alone.
// Chosen to POP against the obsidian/indigo sanctum: bright cyan, pink,
// orange and mint. Deliberately NO gold (reserved for brand/Vault accents)
// and NO violet (reserved for the arcane rune glow) — a player in either hue
// would blend into the UI chrome.
export const SEAT_COLORS = ["#6FD3FF", "#FF6FAE", "#FFA149", "#3DF0C0"] as const;

export function seatColorFor(index: number): string {
  return SEAT_COLORS[((index % SEAT_COLORS.length) + SEAT_COLORS.length) % SEAT_COLORS.length]!;
}

// Hit-effect palette, one entry per suit (plus Joker). The base suit colors
// above are too dark to read against the obsidian board, so each effect gets
// a bright `accent` and a near-white `flash` alongside its `core` suit color.
// Spades keep an ink core but use steel/white so the sword survives the dark
// background. Also doubles as the per-suit gem/metal theme for card frames.
export type SuitFxKey = "C" | "H" | "D" | "S" | "JOKER";
export const SUIT_FX: Record<SuitFxKey, { core: string; accent: string; flash: string }> = {
  C: { core: SUIT_GREEN, accent: "#66BB6A", flash: "#E8F5E9" },
  H: { core: SUIT_RED, accent: "#F06292", flash: "#FCE4EC" },
  D: { core: SUIT_BLUE, accent: "#64B5F6", flash: "#E3F2FD" },
  S: { core: SUIT_INK, accent: "#CFD8DC", flash: "#FFFFFF" },
  JOKER: { core: BRAND, accent: "#FFD54F", flash: "#FFF8E1" },
};

const Colors = {
  brand: BRAND,
  brandDim: BRAND_DIM,
  bgDeep: BG_OBSIDIAN,
  bgCard: BG_ZONE_MID,
  bgCardFace: BG_CARD_FACE,
  bgSurface: BG_ZONE_SURFACE,
  bgZoneDeep: BG_ZONE_DEEP,
  bgHandTray: BG_HAND_TRAY,
  textPrimary: TEXT_PRIMARY,
  textSecondary: TEXT_SECONDARY,
  textMuted: TEXT_MUTED,
  textOnCard: TEXT_ON_CARD,
  suitRed: SUIT_RED,
  suitBlue: SUIT_BLUE,
  suitGreen: SUIT_GREEN,
  suitInk: SUIT_INK,
  accentRed: ACCENT_RED,
  accentRedSoft: ACCENT_RED_SOFT,
  accentBlue: ACCENT_BLUE,
  accentGreen: ACCENT_GREEN,
  accentGreenSoft: ACCENT_GREEN_SOFT,
  arcane: ARCANE,
  arcaneDim: ARCANE_DIM,
  border: BORDER,
  borderLight: BORDER_LIGHT,
  suitFx: SUIT_FX,
};

export default Colors;
