import { describe, it, expect } from "vitest";
import { pushLifeEvent } from "../lifeEvents";
import { discardHeartToHeal } from "../attachments";
import { applyClub } from "../clubs";
import { dispatchAction } from "../dispatcher";
import { makeState, makePlayer, P1, P2 } from "./helpers";

describe("pushLifeEvent", () => {
  it("assigns monotonically increasing seq across back-to-back events", () => {
    let state = makeState({
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    state = pushLifeEvent(state, {
      kind: "attack_damage",
      targetPlayerId: P2,
      amount: 7,
      resultingLife: 13,
      actorPlayerId: P1,
    });
    state = pushLifeEvent(state, {
      kind: "attack_damage",
      targetPlayerId: P2,
      amount: 7,
      resultingLife: 6,
      actorPlayerId: P1,
    });
    expect(state.lifeEvents).toHaveLength(2);
    expect(state.lifeEvents![0]!.seq).toBe(1);
    expect(state.lifeEvents![1]!.seq).toBe(2);
    expect(state.lifeEvents![1]!.resultingLife).toBe(6);
  });

  it("caps the feed at 50 entries while seq keeps increasing", () => {
    let state = makeState({
      players: { [P1]: makePlayer(P1), [P2]: makePlayer(P2) },
    });
    for (let i = 0; i < 60; i++) {
      state = pushLifeEvent(state, {
        kind: "heal",
        targetPlayerId: P1,
        amount: 1,
        resultingLife: 20,
      });
    }
    expect(state.lifeEvents).toHaveLength(50);
    expect(state.lifeEvents![state.lifeEvents!.length - 1]!.seq).toBe(60);
  });
});

describe("life events emitted by game actions", () => {
  it("club burn at a player records amount, resulting life, actor and source", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D", "9D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["7C"] }),
        [P2]: makePlayer(P2, { life: 20 }),
      },
    });
    const res = applyClub(state, P1, "7C", P2, undefined);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ev = res.value.lifeEvents!.at(-1)!;
    expect(ev.kind).toBe("club_damage");
    expect(ev.targetPlayerId).toBe(P2);
    expect(ev.amount).toBe(7);
    expect(ev.resultingLife).toBe(13);
    expect(ev.actorPlayerId).toBe(P1);
    expect(ev.sourceCardId).toBe("7C");
  });

  it("elimination emits a distinct event in sequence after a lethal face Club resolves", () => {
    // A lethal face Club now opens a response window; the club_damage event and
    // the elimination land together when the defender confirms without saving
    // themselves (dispatchAction runs applyStateBasedActions after confirm).
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D", "9D", "8D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["9C"] }),
        [P2]: makePlayer(P2, { life: 5 }),
      },
    });
    const opened = dispatchAction(state, P1, { type: "apply_club", clubCardId: "9C", targetPlayerId: P2 });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const res = dispatchAction(opened.value, P2, { type: "confirm_club_response" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const events = res.value.lifeEvents!;
    const club = events.find((e) => e.kind === "club_damage")!;
    const elim = events.find((e) => e.kind === "elimination")!;
    expect(club.resultingLife).toBe(0);
    expect(elim.targetPlayerId).toBe(P2);
    expect(elim.resultingLife).toBe(0);
    expect(elim.seq).toBe(club.seq + 1);
  });

  it("overkill Joker damage clamps both state life and logged resulting life at 0", () => {
    // Lethal to the face → response window; damage applies on confirm.
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D", "9D", "8D", "7D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["JOKER1"] }),
        [P2]: makePlayer(P2, { life: 3 }),
      },
    });
    const opened = dispatchAction(state, P1, {
      type: "play_joker",
      cardId: "JOKER1",
      mode: "damage_player",
      targetPlayerId: P2,
    });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    const res = dispatchAction(opened.value, P2, { type: "confirm_club_response" });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.players[P2]!.life).toBe(0);
    const ev = res.value.lifeEvents!.find((e) => e.kind === "joker_damage")!;
    expect(ev.amount).toBe(10);
    expect(ev.resultingLife).toBe(0);
  });

  it("heal records positive amount and resulting life", () => {
    const state = makeState({
      phase: "main",
      activePlayerId: P1,
      mine: ["10D", "9D"],
      players: {
        [P1]: makePlayer(P1, { hand: ["4H"], life: 10 }),
        [P2]: makePlayer(P2),
      },
    });
    const res = discardHeartToHeal(state, P1, "4H", P1);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    const ev = res.value.lifeEvents!.at(-1)!;
    expect(ev.kind).toBe("heal");
    expect(ev.amount).toBe(4);
    expect(ev.resultingLife).toBe(14);
    expect(ev.sourceCardId).toBe("4H");
  });
});
