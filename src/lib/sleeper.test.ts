import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdir, readFile, writeFile } from "fs/promises";
import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getNflPlayers,
  getNflState,
  getTradedPicks,
  getUser,
  getUserDrafts,
  SleeperNotFoundError,
} from "./sleeper";

const fsMocks = vi.hoisted(() => ({
  mkdir: vi.fn(),
  readFile: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  ...fsMocks,
  default: fsMocks,
}));

afterEach(() => {
  vi.unstubAllGlobals();
  vi.mocked(mkdir).mockReset();
  vi.mocked(readFile).mockReset();
  vi.mocked(writeFile).mockReset();
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

  it("loads a league", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(jsonResponse(200, { league_id: "l1", name: "Home" })),
    );
    await expect(getLeague("l1")).resolves.toMatchObject({ league_id: "l1" });
  });
});

describe("getNflPlayers", () => {
  it("fetches active players, writes the cache, and serves memory next", async () => {
    vi.mocked(readFile).mockRejectedValue(new Error("missing"));
    vi.mocked(mkdir).mockResolvedValue(undefined);
    vi.mocked(writeFile).mockResolvedValue(undefined);
    const players = { "1": { player_id: "1", full_name: "Ja'Marr Chase" } };
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, players)));

    await expect(getNflPlayers()).resolves.toEqual(players);
    await expect(getNflPlayers()).resolves.toEqual(players);
    expect(fetch).toHaveBeenCalledOnce();
    expect(writeFile).toHaveBeenCalled();
  });

  it("serves a fresh on-disk cache and swallows cache writes that fail", async () => {
    vi.resetModules();
    vi.mocked(readFile).mockResolvedValue(
      JSON.stringify({
        fetchedAt: Date.now(),
        players: { "2": { player_id: "2", full_name: "Cached" } },
      }),
    );
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const { getNflPlayers: loadFromDisk } = await import("./sleeper");
    await expect(loadFromDisk()).resolves.toEqual({
      "2": { player_id: "2", full_name: "Cached" },
    });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.resetModules();
    vi.mocked(readFile).mockRejectedValue(new Error("missing"));
    vi.mocked(mkdir).mockRejectedValue(new Error("ro fs"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(jsonResponse(200, { "3": { player_id: "3" } })));
    const { getNflPlayers: loadAndFailWrite } = await import("./sleeper");
    await expect(loadAndFailWrite()).resolves.toEqual({ "3": { player_id: "3" } });
  });
});
