import { describe, it, expect, vi } from "vitest";
import type { Request, Response } from "express";
import {
  planAccountDeletion,
  createDeleteAccountHandler,
  type AccountDeletionDeps,
  type EndedMatch,
  type MembershipMatch,
} from "../accountDeletion";

const ME = "user-me";
const ALICE = "user-alice";
const BOB = "user-bob";
const BOT = "user-bot";

const human = (userId: string) => ({ userId, isBot: false });
const bot = { userId: BOT, isBot: true };

function match(id: string, status: MembershipMatch["status"], players: MembershipMatch["players"]): MembershipMatch {
  return { id, status, players };
}

describe("planAccountDeletion", () => {
  it("deletes solo vs-AI matches and lobbies nobody joined", () => {
    const plan = planAccountDeletion(ME, [
      match("solo-live", "in_progress", [human(ME), bot]),
      match("solo-done", "finished", [human(ME), bot]),
      match("empty-lobby", "waiting", [human(ME)]),
    ]);
    expect(plan.deleteMatchIds).toEqual(["solo-live", "solo-done", "empty-lobby"]);
    expect(plan.endMatches).toEqual([]);
    expect(plan.keptMatchIds).toEqual([]);
    expect(plan.keepUserRow).toBe(false);
  });

  it("forfeits an in-progress 1v1 to the opponent and keeps it", () => {
    const plan = planAccountDeletion(ME, [match("duel", "in_progress", [human(ME), human(ALICE)])]);
    expect(plan.deleteMatchIds).toEqual([]);
    expect(plan.endMatches).toEqual([{ matchId: "duel", winnerUserId: ALICE, notifyUserIds: [ALICE] }]);
    expect(plan.keptMatchIds).toEqual(["duel"]);
    expect(plan.keepUserRow).toBe(true);
  });

  it("ends multi-player and waiting shared matches with no winner", () => {
    const plan = planAccountDeletion(ME, [
      match("ffa", "in_progress", [human(ME), human(ALICE), human(BOB)]),
      match("lobby", "waiting", [human(ME), human(ALICE)]),
    ]);
    expect(plan.endMatches).toEqual([
      { matchId: "ffa", winnerUserId: null, notifyUserIds: [ALICE, BOB] },
      { matchId: "lobby", winnerUserId: null, notifyUserIds: [ALICE] },
    ]);
    expect(plan.keptMatchIds).toEqual(["ffa", "lobby"]);
  });

  it("keeps finished shared matches untouched apart from anonymising", () => {
    const plan = planAccountDeletion(ME, [match("old", "finished", [human(ME), human(ALICE)])]);
    expect(plan.deleteMatchIds).toEqual([]);
    expect(plan.endMatches).toEqual([]);
    expect(plan.keptMatchIds).toEqual(["old"]);
    expect(plan.keepUserRow).toBe(true);
  });

  it("never touches matches the caller is not in", () => {
    const plan = planAccountDeletion(ME, [
      match("alice-solo", "in_progress", [human(ALICE), bot]),
      match("alice-bob", "in_progress", [human(ALICE), human(BOB)]),
    ]);
    expect(plan).toEqual({ deleteMatchIds: [], endMatches: [], keptMatchIds: [], keepUserRow: false });
  });
});

function fakeReq(user: { internalUserId: string; providerUserId: string } | null, extra: Partial<Request> = {}) {
  return {
    user: user ? { ...user, displayName: "Me" } : undefined,
    isAuthenticated() {
      return user != null;
    },
    log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
    ...extra,
  } as unknown as Request;
}

function fakeRes() {
  const res = {
    statusCode: 200,
    body: undefined as unknown,
    ended: false,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(body: unknown) {
      res.body = body;
      return res;
    },
    end() {
      res.ended = true;
      return res;
    },
  };
  return res;
}

function fakeDeps(overrides: Partial<AccountDeletionDeps> = {}) {
  const calls: string[] = [];
  const ended: EndedMatch[] = [{ matchId: "duel", winnerUserId: ALICE, notifyUserIds: [ALICE] }];
  const deps = {
    deleteUserData: vi.fn(async (id: string) => {
      calls.push(`db:${id}`);
      return ended;
    }),
    notifyEndedMatches: vi.fn(() => {
      calls.push("notify");
    }),
    deleteAuthUser: vi.fn(async (id: string) => {
      calls.push(`clerk:${id}`);
    }),
    ...overrides,
  };
  return { deps, calls, ended };
}

describe("DELETE /api/auth/account handler", () => {
  const caller = { internalUserId: ME, providerUserId: "user_clerk_me" };

  it("requires auth and does nothing for an anonymous request", async () => {
    const { deps } = fakeDeps();
    const res = fakeRes();
    await createDeleteAccountHandler(deps)(fakeReq(null), res as unknown as Response);
    expect(res.statusCode).toBe(401);
    expect(deps.deleteUserData).not.toHaveBeenCalled();
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("deletes only the caller, ignoring ids in the body or params", async () => {
    const { deps } = fakeDeps();
    const res = fakeRes();
    const req = fakeReq(caller, {
      body: { userId: ALICE, providerUserId: "user_clerk_alice" },
      params: { id: ALICE },
    } as Partial<Request>);
    await createDeleteAccountHandler(deps)(req, res as unknown as Response);
    expect(deps.deleteUserData).toHaveBeenCalledExactlyOnceWith(ME);
    expect(deps.deleteAuthUser).toHaveBeenCalledExactlyOnceWith("user_clerk_me");
  });

  it("runs the database step before Clerk and returns 204", async () => {
    const { deps, calls, ended } = fakeDeps();
    const res = fakeRes();
    await createDeleteAccountHandler(deps)(fakeReq(caller), res as unknown as Response);
    expect(calls).toEqual([`db:${ME}`, "notify", "clerk:user_clerk_me"]);
    expect(deps.notifyEndedMatches).toHaveBeenCalledWith(ended);
    expect(res.statusCode).toBe(204);
    expect(res.ended).toBe(true);
  });

  it("does not delete the Clerk user when the database step fails", async () => {
    const { deps } = fakeDeps({
      deleteUserData: vi.fn(async () => {
        throw new Error("tx rolled back");
      }),
    });
    const res = fakeRes();
    await createDeleteAccountHandler(deps)(fakeReq(caller), res as unknown as Response);
    expect(res.statusCode).toBe(500);
    expect(deps.deleteAuthUser).not.toHaveBeenCalled();
  });

  it("reports a Clerk failure so the user can retry", async () => {
    const { deps } = fakeDeps({
      deleteAuthUser: vi.fn(async () => {
        throw Object.assign(new Error("clerk down"), { status: 503 });
      }),
    });
    const res = fakeRes();
    await createDeleteAccountHandler(deps)(fakeReq(caller), res as unknown as Response);
    expect(res.statusCode).toBe(502);
  });

  it("treats an already-deleted Clerk user as success", async () => {
    const { deps } = fakeDeps({
      deleteAuthUser: vi.fn(async () => {
        throw Object.assign(new Error("not found"), { status: 404 });
      }),
    });
    const res = fakeRes();
    await createDeleteAccountHandler(deps)(fakeReq(caller), res as unknown as Response);
    expect(res.statusCode).toBe(204);
  });
});
