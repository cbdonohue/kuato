import { describe, expect, it } from "vitest";
import {
  assembleNflverseBundle,
  EMPTY_NFLVERSE,
  getNflverseSeason,
  parsePlayerIds,
  parsePlayerStats,
  parseSnapShares,
} from "./nflverse";

describe("parsePlayerIds", () => {
  it("skips NA ids and maps sleeper and pfr keys", () => {
    const parsed = parsePlayerIds(`sleeper_id,gsis_id,pfr_id
3198,00-0032764,HenrDe00
NA,00-1,XxxxXx00
9999,NA,YyyyYy00
`);
    expect(parsed.sleeperToGsis).toEqual({ "3198": "00-0032764" });
    expect(parsed.gsisToPfr).toEqual({ "00-0032764": "HenrDe00", "00-1": "XxxxXx00" });
  });
});

describe("parseSnapShares", () => {
  it("averages offense snap percent and converts values over 1", () => {
    const snaps = parseSnapShares(`pfr_player_id,position,offense_snaps,offense_pct
HenrDe00,RB,45,0.8
HenrDe00,RB,50,90
KickKk00,K,0,0
SkipSs00,WR,0,0.9
`);
    expect(snaps.HenrDe00).toBeCloseTo(85, 5);
    expect(snaps.KickKk00).toBeUndefined();
    expect(snaps.SkipSs00).toBeUndefined();
  });
});

describe("parsePlayerStats", () => {
  it("keeps skill players and ignores unknown positions", () => {
    const stats = parsePlayerStats(
      `player_id,position,games,passing_yards,passing_tds,passing_interceptions,rushing_yards,rushing_tds,receptions,receiving_yards,receiving_tds,fantasy_points,fantasy_points_ppr
00-1,QB,16,4000,30,8,200,2,0,0,0,280,280
00-2,OL,17,0,0,0,0,0,0,0,0,0,0
`,
      2025,
    );
    expect(stats["00-1"]?.passingTds).toBe(30);
    expect(stats["00-1"]?.fantasyStd).toBe(280);
    expect(stats["00-2"]).toBeUndefined();
  });
});

describe("assembleNflverseBundle", () => {
  it("returns an empty-safe bundle when snap and id files are blank", () => {
    const bundle = assembleNflverseBundle({
      season: 2025,
      statsCsv: `player_id,position,games,fantasy_points,fantasy_points_ppr
00-1,RB,10,100,120
`,
      snapsCsv: "",
      idsCsv: "",
    });
    expect(bundle.byGsis["00-1"]?.snapPct).toBeNull();
    expect(bundle.sleeperToGsis).toEqual({});
  });
});

describe("getNflverseSeason", () => {
  it("returns the empty bundle for invalid seasons", async () => {
    expect(await getNflverseSeason(Number.NaN)).toEqual(EMPTY_NFLVERSE);
    expect(await getNflverseSeason(1999)).toEqual(EMPTY_NFLVERSE);
  });
});
