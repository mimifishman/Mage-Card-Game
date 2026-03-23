import { describe, it, expect } from "vitest";
import { calculateVaultFromMine, availableVault } from "../vault";
import { makePlayer } from "./helpers";

describe("calculateVaultFromMine", () => {
  it("returns 0 for empty mine", () => {
    expect(calculateVaultFromMine([])).toBe(0);
  });

  it("sums pip values of diamonds in mine", () => {
    expect(calculateVaultFromMine(["2D", "5D", "AD"])).toBe(8);
  });

  it("includes 10D", () => {
    expect(calculateVaultFromMine(["10D"])).toBe(10);
  });
});

describe("availableVault", () => {
  it("returns base vault when no spending", () => {
    const player = makePlayer("p1", { mine: ["5D", "3D"] });
    expect(availableVault(player)).toBe(8);
  });

  it("subtracts spent amount", () => {
    const player = makePlayer("p1", {
      mine: ["5D"],
      vault: { tempBoost: 0, spent: 3 },
    });
    expect(availableVault(player)).toBe(2);
  });

  it("includes temp boost", () => {
    const player = makePlayer("p1", {
      mine: ["5D"],
      vault: { tempBoost: 4, spent: 0 },
    });
    expect(availableVault(player)).toBe(9);
  });
});
