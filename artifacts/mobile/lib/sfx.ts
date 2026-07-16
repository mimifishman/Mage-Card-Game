import { Platform } from "react-native";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import type { EffectKind, EffectSuit } from "@/lib/hitEffectsDiff";
import sfxZap from "../assets/sfx/zap.wav";
import sfxChime from "../assets/sfx/chime.wav";
import sfxShatter from "../assets/sfx/shatter.wav";
import sfxClang from "../assets/sfx/clang.wav";
import sfxStar from "../assets/sfx/star.wav";

// Suit hit-effect sounds. The WAVs are short synthesized one-shots generated
// by a script (license-free, ~15-30 KB each); swap the files for professional
// SFX any time without touching this module.
//
// Audio is decoration: every call is fail-safe (no-op on web, try/catch on
// native) so a codec/session problem can never break gameplay.

const SOURCES: Record<EffectSuit, number> = {
  C: sfxZap,
  H: sfxChime,
  D: sfxShatter,
  S: sfxClang,
  JOKER: sfxStar,
};

const players = new Map<EffectSuit, AudioPlayer>();
let audioModeSet = false;

function getPlayer(suit: EffectSuit): AudioPlayer {
  let player = players.get(suit);
  if (!player) {
    player = createAudioPlayer(SOURCES[suit]);
    player.volume = 0.7;
    players.set(suit, player);
  }
  return player;
}

export function playSuitSfx(suit: EffectSuit, kind: EffectKind): void {
  if (Platform.OS === "web") return;
  try {
    if (!audioModeSet) {
      audioModeSet = true;
      // Game feedback should be audible with the iOS mute switch on, and
      // should duck under (not pause) the user's music.
      setAudioModeAsync({ playsInSilentMode: true, interruptionMode: "mixWithOthers" }).catch(
        () => {},
      );
    }
    const player = getPlayer(suit);
    player.volume = kind === "destroy" ? 0.9 : 0.7;
    player.seekTo(0);
    player.play();
  } catch {
    // Missing asset, dead audio session, etc. — skip the sound, keep playing.
  }
}
