import { describe, expect, it } from "vitest";
import { buildEnrichmentIndex, fantasyPointsFor, statLineFor } from "./enrich";
import { assembleNflverseBundle, type NflversePlayerSeason } from "./nflverse";
import type { SleeperPlayer } from "./types";

const statsCsv = `player_id,player_name,position,games,passing_yards,passing_tds,passing_interceptions,rushing_yards,rushing_tds,receptions,receiving_yards,receiving_tds,fantasy_points,fantasy_points_ppr
00-0032764,D.Henry,RB,17,0,0,0,1921,16,20,150,1,300,320
`;

const snapsCsv = `game_id,season,week,player,pfr_player_id,position,team,offense_snaps,offense_pct,defense_snaps,defense_pct,st_snaps,st_pct
2025_01,2025,1,Derrick Henry,HenrDe00,RB,BAL,45,0.8,0,0,0,0
2025_02,2025,2,Derrick Henry,HenrDe00,RB,BAL,50,0.9,0,0,0,0
`;

const idsCsv = `mfl_id,gsis_id,pff_id,sleeper_id,pfr_id,name,position,team
1,00-0032764,NA,3198,HenrDe00,Derrick Henry,RB,BAL
2,00-9999999,NA,9999,XxxxXx00,Missing Guy,RB,DET
`;

describe("assembleNflverseBundle", () => {
  it("joins stats and snap share through gsis/pfr ids", () => {
    const bundle = assembleNflverseBundle({
      season: 2025,
      statsCsv,
      snapsCsv,
      idsCsv,
    });
    const henry = bundle.byGsis["00-0032764"];
    expect(henry.games).toBe(17);
    expect(henry.fantasyPpr).toBe(320);
    expect(henry.snapPct).toBeCloseTo(85, 5);
    expect(bundle.sleeperToGsis["3198"]).toBe("00-0032764");
  });
});

describe("scoring helpers", () => {
  const season: NflversePlayerSeason = {
    season: 2025,
    games: 17,
    fantasyStd: 100,
    fantasyPpr: 150,
    snapPct: 85,
    position: "WR",
    passingYards: 0,
    passingTds: 0,
    interceptions: 0,
    rushingYards: 20,
    rushingTds: 0,
    receptions: 90,
    receivingYards: 1200,
    receivingTds: 8,
  };

  it("selects std, ppr, and half-ppr points", () => {
    expect(fantasyPointsFor(season, "std")).toBe(100);
    expect(fantasyPointsFor(season, "ppr")).toBe(150);
    expect(fantasyPointsFor(season, "half_ppr")).toBe(125);
  });

  it("builds a receiving line", () => {
    expect(statLineFor(season)).toBe("90 rec, 1200 yds, 8 TD");
  });

  it("builds QB, RB, and kicker lines", () => {
    expect(
      statLineFor({
        ...season,
        position: "QB",
        passingYards: 4300.4,
        passingTds: 32,
        interceptions: 9,
      }),
    ).toBe("4300 yds, 32 TD, 9 INT");
    expect(
      statLineFor({
        ...season,
        position: "RB",
        rushingYards: 1100.6,
        rushingTds: 12,
        receptions: 40,
        receivingTds: 2,
      }),
    ).toBe("1101 rush, 40 rec, 14 TD");
    expect(statLineFor({ ...season, position: "K", games: 16 })).toBe("16 g");
  });
});

describe("buildEnrichmentIndex", () => {
  it("uses Sleeper gsis_id and FFC ADP", () => {
    const bundle = assembleNflverseBundle({
      season: 2025,
      statsCsv,
      snapsCsv,
      idsCsv,
    });
    const players: Record<string, SleeperPlayer> = {
      "3198": {
        player_id: "3198",
        full_name: "Derrick Henry",
        position: "RB",
        team: "BAL",
        status: "Active",
        search_rank: 4,
        gsis_id: "00-0032764",
      },
    };
    const extras = buildEnrichmentIndex(
      players,
      [
        {
          player_id: 10,
          name: "Derrick Henry",
          position: "RB",
          team: "BAL",
          adp: 12.4,
          stdev: 2,
          bye: 7,
        },
      ],
      bundle,
      "ppr",
    );
    const extra = extras.get("3198");
    expect(extra?.adp).toBe(12.4);
    expect(extra?.byeWeek).toBe(7);
    expect(extra?.lastSeason?.fantasyPts).toBe(320);
    expect(extra?.lastSeason?.snapPct).toBe(85);
  });

  it("falls back to DynastyProcess sleeper_id when gsis is missing", () => {
    const bundle = assembleNflverseBundle({
      season: 2025,
      statsCsv,
      snapsCsv,
      idsCsv,
    });
    const players: Record<string, SleeperPlayer> = {
      "3198": {
        player_id: "3198",
        full_name: "Derrick Henry",
        position: "RB",
        team: "BAL",
        status: "Active",
        search_rank: 4,
      },
    };
    const extras = buildEnrichmentIndex(players, [], bundle, "std");
    expect(extras.get("3198")?.lastSeason?.fantasyPts).toBe(300);
  });
});
