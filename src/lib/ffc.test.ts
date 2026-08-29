import { describe, expect, it } from "vitest";
import {
  canonPosition,
  canonTeam,
  ffcFormat,
  indexFfcPlayers,
  matchFfc,
  nearestFfcTeams,
  normalizeName,
  type FfcAdpPlayer,
} from "./ffc";

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
    expect(canonTeam("JAC")).toBe("JAX");
    expect(canonTeam("LVR")).toBe("LV");
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
});
