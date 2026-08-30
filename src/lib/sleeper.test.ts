import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getDraft,
  getDraftPicks,
  getLeagueRosters,
  getLeagueUsers,
  getNflState,
  getTradedPicks,
  getUser,
  getUserDrafts,
  SleeperNotFoundError,
} from "./sleeper";

afterEach(() => {
  vi.unstubAllGlobals();
});

function jsonResponse(status: number, body: unknown) {
  return {
    status,
    ok: status >= 200 && status < 300,
    json: async () => body,
  };
}

describe("sleeperGet wrappers", () => {
  it("loads a user and rejects missing ids", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { user_id: "u1", username: "brian" })),
    );
    await expect(getUser("brian")).resolves.toMatchObject({ user_id: "u1" });

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, {})));
    await expect(getUser("ghost")).rejects.toBeInstanceOf(SleeperNotFoundError);
  });

  it("throws SleeperNotFoundError on 404 and a generic error on other failures", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(404, {})));
    await expect(getDraft("missing")).rejects.toBeInstanceOf(SleeperNotFoundError);

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(500, {})));
    await expect(getNflState()).rejects.toThrow("Sleeper /state/nfl failed (500)");
  });

  it("returns empty arrays when list endpoints send a non-array", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { nope: true })));
    expect(await getUserDrafts("u1", "2026")).toEqual([]);
    expect(await getDraftPicks("d1")).toEqual([]);
    expect(await getTradedPicks("d1")).toEqual([]);
    expect(await getLeagueUsers("l1")).toEqual([]);
    expect(await getLeagueRosters("l1")).toEqual([]);
  });
});
