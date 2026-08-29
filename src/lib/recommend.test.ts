import { describe, expect, it } from "vitest";
import {
  detectUnsupported,
  picksUntilRosterOnClock,
  recommend,
  rosterForPick,
  slotForPick,
  toPlayerView,
  type ClockInput,
  type RecommendInput,
} from "./recommend";
import type { EnrichmentIndex, SleeperPick, SleeperPlayer } from "./types";

const twelveTeamSnake: ClockInput = {
  teams: 12,
  rounds: 15,
  draftType: "snake",
  slotToRoster: Object.fromEntries(
    Array.from({ length: 12 }, (_, i) => [String(i + 1), i + 1]),
  ),
  tradedPicks: [],
  season: "2026",
};

function player(
  id: string,
  position: string,
  rank: number,
  extras: Partial<SleeperPlayer> = {},
): SleeperPlayer {
  return {
    player_id: id,
    first_name: id,
    last_name: position,
    position,
    fantasy_positions: [position],
    team: "KC",
    status: "Active",
    search_rank: rank,
    ...extras,
  };
}

function pick(playerId: string, rosterId: number, pickNo: number): SleeperPick {
  return {
    player_id: playerId,
    picked_by: String(rosterId),
    roster_id: rosterId,
    round: Math.ceil(pickNo / 12),
    draft_slot: ((pickNo - 1) % 12) + 1,
    pick_no: pickNo,
    draft_id: "d1",
  };
}

describe("slotForPick", () => {
  it("uses linear slots in odd snake rounds", () => {
    expect(slotForPick(1, 12, "snake")).toBe(1);
    expect(slotForPick(3, 12, "snake")).toBe(3);
    expect(slotForPick(12, 12, "snake")).toBe(12);
  });

  it("reverses even snake rounds", () => {
    expect(slotForPick(13, 12, "snake")).toBe(12);
    expect(slotForPick(14, 12, "snake")).toBe(11);
    expect(slotForPick(24, 12, "snake")).toBe(1);
    expect(slotForPick(25, 12, "snake")).toBe(1);
  });

  it("does not reverse linear drafts", () => {
    expect(slotForPick(13, 12, "linear")).toBe(1);
    expect(slotForPick(14, 12, "linear")).toBe(2);
  });
});

describe("picksUntilRosterOnClock", () => {
  it("is 2 when slot 3 has not picked yet", () => {
    const result = picksUntilRosterOnClock(1, 3, twelveTeamSnake);
    expect(result.picksUntil).toBe(2);
    expect(result.nextPickNoForRoster).toBe(3);
  });

  it("is 0 when the roster is on the clock", () => {
    expect(picksUntilRosterOnClock(1, 1, twelveTeamSnake).picksUntil).toBe(0);
  });

  it("waits through the snake turn after round 1", () => {
    const result = picksUntilRosterOnClock(13, 1, twelveTeamSnake);
    expect(result.nextPickNoForRoster).toBe(24);
    expect(result.picksUntil).toBe(11);
  });
});

describe("traded picks", () => {
  it("moves a round-1 pick to the new roster", () => {
    const input: ClockInput = {
      ...twelveTeamSnake,
      tradedPicks: [
        {
          season: "2026",
          round: 1,
          roster_id: 1,
          owner_id: 2,
        },
        {
          season: "2026",
          round: 1,
          roster_id: 2,
          owner_id: 1,
        },
      ],
    };
    expect(rosterForPick(1, input)).toBe(2);
    expect(rosterForPick(2, input)).toBe(1);
    expect(picksUntilRosterOnClock(1, 1, input).picksUntil).toBe(1);
  });
});

describe("detectUnsupported", () => {
  it("flags auction and dynasty", () => {
    expect(detectUnsupported({ draftType: "auction" })).toBe("auction");
    expect(detectUnsupported({ draftType: "snake", leagueSettings: { type: 2 } })).toBe(
      "dynasty",
    );
    expect(detectUnsupported({ draftType: "snake", leagueSettings: { type: 0 } })).toBe(
      null,
    );
  });
});

describe("recommend", () => {
  const rosterPositions = [
    "QB",
    "RB",
    "RB",
    "WR",
    "WR",
    "TE",
    "FLEX",
    "K",
    "DEF",
    "BN",
    "BN",
  ];

  const basePlayers: Record<string, SleeperPlayer> = {
    qb1: player("qb1", "QB", 18),
    qb2: player("qb2", "QB", 45),
    rb1: player("rb1", "RB", 4),
    wr1: player("wr1", "WR", 8),
    te1: player("te1", "TE", 30),
    k1: player("k1", "K", 140),
    def1: player("def1", "DEF", 150),
    taken: player("taken", "RB", 2),
  };

  function input(overrides: Partial<RecommendInput> = {}): RecommendInput {
    return {
      ...twelveTeamSnake,
      pickNo: 1,
      scoringType: "ppr",
      rosterPositions,
      userRosterId: 1,
      picks: [],
      players: basePlayers,
      picksUntilUser: 0,
      ...overrides,
    };
  }

  it("excludes drafted players", () => {
    const recs = recommend(
      input({
        picks: [pick("taken", 2, 1)],
        pickNo: 2,
      }),
    );
    expect(recs.every((rec) => rec.player.playerId !== "taken")).toBe(true);
  });

  it("suppresses K and DEF before the last two rounds", () => {
    const recs = recommend(input({ pickNo: 1 }));
    expect(recs.every((rec) => rec.player.position !== "K")).toBe(true);
    expect(recs.every((rec) => rec.player.position !== "DEF")).toBe(true);
  });

  it("allows K and DEF in the last two rounds", () => {
    const recs = recommend(
      input({
        pickNo: 12 * 14 + 1,
        rosterPositions: ["K", "DEF", "BN"],
        players: {
          k1: player("k1", "K", 140),
          def1: player("def1", "DEF", 150),
        },
      }),
    );
    expect(recs.some((rec) => rec.player.position === "K" || rec.player.position === "DEF")).toBe(
      true,
    );
  });

  it("boosts QB need in Superflex when the SF slot is open", () => {
    const oneQb = recommend(
      input({
        rosterPositions,
        picks: [pick("qb1", 1, 12)],
        pickNo: 25,
        players: {
          qb1: player("qb1", "QB", 18),
          qb2: player("qb2", "QB", 45),
          wr1: player("wr1", "WR", 40),
        },
      }),
    );
    const superflex = recommend(
      input({
        rosterPositions: [...rosterPositions, "SUPER_FLEX"],
        picks: [pick("qb1", 1, 12)],
        pickNo: 25,
        players: {
          qb1: player("qb1", "QB", 18),
          qb2: player("qb2", "QB", 45),
          wr1: player("wr1", "WR", 40),
        },
      }),
    );
    const qbNeed1 = oneQb.find((rec) => rec.player.playerId === "qb2")?.scores.need ?? 0;
    const qbNeedSf =
      superflex.find((rec) => rec.player.playerId === "qb2")?.scores.need ?? 0;
    expect(qbNeedSf).toBeGreaterThan(qbNeed1);
  });

  it("uses FFC ADP as rank and falling-vs-ADP copy", () => {
    const extras: EnrichmentIndex = new Map([
      [
        "wr1",
        { adp: 5, adpStdev: 1.2, byeWeek: 7, lastSeason: null },
      ],
    ]);
    const recs = recommend(
      input({
        pickNo: 25,
        extras,
        players: { wr1: player("wr1", "WR", 80) },
      }),
    );
    expect(recs[0].player.rank).toBe(5);
    expect(recs[0].player.adp).toBe(5);
    expect(recs[0].player.sleeperRank).toBe(80);
    expect(recs[0].reasons).toContain("Falling vs ADP");
  });

  it("falls back to Sleeper rank when ADP is missing", () => {
    const recs = recommend(input({ pickNo: 1, players: { wr1: player("wr1", "WR", 8) } }));
    expect(recs[0].player.rank).toBe(8);
    expect(recs[0].player.adp).toBeNull();
  });
});

describe("toPlayerView", () => {
  it("adds depth, rookie, and ADP overlay", () => {
    const extras: EnrichmentIndex = new Map([
      ["r1", { adp: 22.2, adpStdev: 3, byeWeek: 10, lastSeason: null }],
    ]);
    const view = toPlayerView(
      player("r1", "RB", 40, { years_exp: 0, age: 21, depth_chart_order: 2 }),
      "r1",
      undefined,
      extras,
    );
    expect(view.rookie).toBe(true);
    expect(view.depth).toBe("RB2");
    expect(view.rank).toBe(22.2);
    expect(view.byeWeek).toBe(10);
  });
});
