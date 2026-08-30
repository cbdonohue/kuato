import { describe, expect, it, vi } from "vitest";
import { fetchText } from "./cache";
import {
  canonPosition,
  canonTeam,
  ffcFormat,
  getFfcAdp,
  indexFfcPlayers,
  matchFfc,
  nearestFfcTeams,
  normalizeName,
  type FfcAdpPlayer,
} from "./ffc";

vi.mock("./cache", () => ({
  fetchText: vi.fn(),
  loadDayCache: vi.fn(async (_name: string, loader: () => Promise<unknown>) => loader()),
}));

const sample: FfcAdpPlayer[] = [
  {
    player_id: 1,
    name: "Jahmyr Gibbs Jr.",
    position: "RB",
    team: "DET",
    adp: 1.5,
    stdev: 0.7,
    bye: 6,
  },
  {
    player_id: 2,
    name: "Ka'imi Fairbairn",
    position: "PK",
    team: "HOU",
    adp: 136.1,
    stdev: 20.5,
    bye: 8,
  },
  {
    player_id: 3,
    name: "Houston Defense",
    position: "DEF",
    team: "HOU",
    adp: 98.1,
    stdev: 9.6,
    bye: 8,
  },
];

describe("ffc mapping", () => {
  it("maps scoring and superflex to FFC formats", () => {
    expect(ffcFormat("ppr", false)).toBe("ppr");
    expect(ffcFormat("half_ppr", false)).toBe("half-ppr");
    expect(ffcFormat("std", false)).toBe("standard");
    expect(ffcFormat("ppr", true)).toBe("2qb");
  });

  it("snaps team counts to 8/10/12/14", () => {
    expect(nearestFfcTeams(12)).toBe(12);
    expect(nearestFfcTeams(16)).toBe(14);
    expect(nearestFfcTeams(9)).toBe(8);
    expect(nearestFfcTeams(11)).toBe(10);
  });

  it("normalizes suffixes, apostrophes, and positions", () => {
    expect(normalizeName("Jahmyr Gibbs Jr.")).toBe("jahmyr gibbs");
    expect(normalizeName("Ka'imi Fairbairn")).toBe("kaimi fairbairn");
    expect(canonPosition("PK")).toBe("K");
    expect(canonPosition("DST")).toBe("DEF");
    expect(canonTeam("JAC")).toBe("JAX");
    expect(canonTeam("LVR")).toBe("LV");
    expect(canonTeam("WSH")).toBe("WAS");
    expect(canonTeam("LA")).toBe("LAR");
    expect(canonTeam("SD")).toBe("LAC");
    expect(canonTeam("STL")).toBe("LAR");
    expect(canonTeam("OAK")).toBe("LV");
  });
});

describe("matchFfc", () => {
  const index = indexFfcPlayers(sample);

  it("matches name, position, and team after normalizing Jr", () => {
    const match = matchFfc("Jahmyr Gibbs", "RB", "DET", index);
    expect(match?.adp).toBe(1.5);
    expect(match?.byeWeek).toBe(6);
  });

  it("maps kickers from PK to K", () => {
    const match = matchFfc("Ka'imi Fairbairn", "K", "HOU", index);
    expect(match?.adp).toBe(136.1);
  });

  it("matches DST by team when names differ", () => {
    const match = matchFfc("Houston Texans", "DEF", "HOU", index);
    expect(match?.adp).toBe(98.1);
    expect(match?.byeWeek).toBe(8);
  });

  it("falls back to name and position when the team is missing", () => {
    const match = matchFfc("Jahmyr Gibbs", "RB", "", index);
    expect(match?.adp).toBe(1.5);
  });

  it("returns null when the same name and position map to two ADPs", () => {
    const crowded = indexFfcPlayers([
      ...sample,
      {
        player_id: 4,
        name: "Jahmyr Gibbs Jr.",
        position: "RB",
        team: "FA",
        adp: 40,
      },
    ]);
    expect(matchFfc("Jahmyr Gibbs", "RB", "DET", crowded)?.adp).toBe(1.5);
    expect(matchFfc("Jahmyr Gibbs", "RB", "KC", crowded)).toBeNull();
  });
});

describe("getFfcAdp", () => {
  it("returns players from the FFC payload", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce(
      JSON.stringify({ status: "ok", players: sample }),
    );
    await expect(
      getFfcAdp({ scoringType: "ppr", superflex: false, teams: 12, year: 2026 }),
    ).resolves.toEqual(sample);
  });

  it("returns an empty list when the request fails or the payload is invalid", async () => {
    vi.mocked(fetchText).mockRejectedValueOnce(new Error("offline"));
    await expect(
      getFfcAdp({ scoringType: "std", superflex: true, teams: 10, year: 2026 }),
    ).resolves.toEqual([]);

    vi.mocked(fetchText).mockResolvedValueOnce(JSON.stringify({ status: "error" }));
    await expect(
      getFfcAdp({ scoringType: "ppr", superflex: false, teams: 12, year: 2026 }),
    ).resolves.toEqual([]);
  });
});
