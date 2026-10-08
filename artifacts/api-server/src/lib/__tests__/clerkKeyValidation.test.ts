import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertClerkKeysForProduction } from "../clerkKeyValidation";

const LIVE_SK = "sk_live_example";
const LIVE_PK = "pk_live_Y2xlcmsubWFnZWNhcmRnYW1lLmNvbSQ";
const TEST_SK = "sk_test_example";
const TEST_PK = "pk_test_bmVhdC1mbHktNDcuY2xlcmsuYWNjb3VudHMuZGV2JA";

describe("assertClerkKeysForProduction", () => {
  const originalEnv = process.env.NODE_ENV;
  let exit: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    exit = vi.spyOn(process, "exit").mockImplementation((() => undefined) as never);
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.restoreAllMocks();
  });

  const run = (sk: string | undefined, pk: string | undefined) =>
    assertClerkKeysForProduction(sk, "CLERK_SECRET_KEY", pk, "CLERK_PUBLISHABLE_KEY");

  it("does nothing outside production, even with test keys", () => {
    process.env.NODE_ENV = "development";
    run(TEST_SK, TEST_PK);
    expect(exit).not.toHaveBeenCalled();
  });

  it("accepts a live pair in production", () => {
    process.env.NODE_ENV = "production";
    run(LIVE_SK, LIVE_PK);
    expect(exit).not.toHaveBeenCalled();
  });

  it.each([
    ["test secret key", TEST_SK, LIVE_PK],
    ["test publishable key", LIVE_SK, TEST_PK],
    ["missing secret key", undefined, LIVE_PK],
    ["missing publishable key", LIVE_SK, undefined],
    ["keys swapped", LIVE_PK, LIVE_SK],
  ])("aborts production startup on %s", (_label, sk, pk) => {
    process.env.NODE_ENV = "production";
    run(sk, pk);
    expect(exit).toHaveBeenCalledWith(1);
  });
});
