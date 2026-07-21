import { describe, it, expect } from "vitest";
import { pushLifeEvent } from "../lifeEvents";
import { discardHeartToHeal } from "../attachments";
import { applyClub } from "../clubs";
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
