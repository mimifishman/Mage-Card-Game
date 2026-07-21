import type { GameState, LifeEvent } from "./types";

/**
 * Cap on the rolling life-event feed kept on state. Large enough that a
 * client polling every couple of seconds can never miss an event, small
 * enough that persisted state stays bounded.
 */
const MAX_LIFE_EVENTS = 50;

/**
 * Appends a life event to the state's rolling feed, assigning the next
 * monotonic sequence number. The feed is trimmed to the most recent
 * MAX_LIFE_EVENTS entries; seq keeps increasing regardless of trimming.
 */
export function pushLifeEvent(
  state: GameState,
  event: Omit<LifeEvent, "seq">,
): GameState {
  const prev = state.lifeEvents ?? [];
  const lastSeq = prev.length > 0 ? prev[prev.length - 1]!.seq : 0;
  const next: LifeEvent = { ...event, seq: lastSeq + 1 };
  return {
    ...state,
    lifeEvents: [...prev.slice(-(MAX_LIFE_EVENTS - 1)), next],
  };
}
