import { describe, it, expect } from "vitest";
import { canPlayerInitiateInterrupt, type InterruptInitiationContext } from "@/lib/gameUtils";

const base: InterruptInitiationContext = {
  inDuel: false,
  isMyTurn: false,
  isMyDuelTurn: false,
  isDefender: false,
  isClubResponder: false,
  inInterrupt: false,
  amIEliminated: false,
};

describe("canPlayerInitiateInterrupt", () => {
  it("lets a pure bystander initiate during another player's normal turn", () => {
    expect(canPlayerInitiateInterrupt({ ...base })).toBe(true);
  });

  it("blocks the active player on their own turn", () => {
    expect(canPlayerInitiateInterrupt({ ...base, isMyTurn: true })).toBe(false);
  });

  it("blocks the current defender and club responder", () => {
    expect(canPlayerInitiateInterrupt({ ...base, isDefender: true })).toBe(false);
    expect(canPlayerInitiateInterrupt({ ...base, isClubResponder: true })).toBe(false);
  });

  it("blocks eliminated players and players already inside an interrupt window", () => {
    expect(canPlayerInitiateInterrupt({ ...base, amIEliminated: true })).toBe(false);
    expect(canPlayerInitiateInterrupt({ ...base, inInterrupt: true })).toBe(false);
  });

  it("lets a duel participant initiate on the OTHER participant's duel turn", () => {
    // During the attacker's duel turn, the defender (not the turn-holder) may
    // interrupt. Note isMyTurn stays true for the original attacker throughout
    // the duel, which must not block them on the defender's turn.
    expect(
      canPlayerInitiateInterrupt({ ...base, inDuel: true, isMyDuelTurn: false, isMyTurn: true }),
    ).toBe(true);
    expect(
      canPlayerInitiateInterrupt({ ...base, inDuel: true, isMyDuelTurn: false, isMyTurn: false }),
    ).toBe(true);
  });

  it("blocks the current duel turn-holder from initiating a redundant interrupt", () => {
    expect(
      canPlayerInitiateInterrupt({ ...base, inDuel: true, isMyDuelTurn: true }),
    ).toBe(false);
  });

  it("lets a bystander interrupt during a duel between two other players", () => {
    expect(
      canPlayerInitiateInterrupt({ ...base, inDuel: true, isMyDuelTurn: false }),
    ).toBe(true);
  });
});
