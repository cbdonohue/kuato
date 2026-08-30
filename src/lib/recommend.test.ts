import { describe, expect, it } from "vitest";
import {
  adjustValueForStdev,
  beforeYourPickSummary,
  byeClusterPenalty,
  detectUnsupported,
  depthLabel,
  depthOrder,
  depthScore,
  fillRosterSlots,
  injuryPenalty,
  injuryReason,
  invertDraftOrder,
  isAuction,
  isDynastyLeague,
  isSuperflex,
  nextPickNumber,
  picksUntilRosterOnClock,
  playerName,
  productionScore,
  recommend,
  rosterForPick,
  scoringFromSettings,
  sleeperRankValue,
  slotForPick,
  snapScore,
  starterByeCounts,
  toPlayerView,
  userPicksForRoster,
  type ClockInput,
  type RecommendInput,
} from "./recommend";
import type {
  EnrichmentIndex,
  LastSeasonStats,
  PlayerExtras,
  SleeperPick,
  SleeperPlayer,
} from "./types";

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

  it("returns 0 for invalid pick or team counts", () => {
    expect(slotForPick(0, 12, "snake")).toBe(0);
    expect(slotForPick(1, 0, "snake")).toBe(0);
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

  it("returns null after the draft is complete", () => {
    expect(picksUntilRosterOnClock(181, 1, twelveTeamSnake)).toEqual({
      picksUntil: null,
      nextPickNoForRoster: null,
    });
  });
});

describe("nextPickNumber", () => {
  it("starts at 1 and advances past the highest pick", () => {
    expect(nextPickNumber([])).toBe(1);
    expect(nextPickNumber([pick("a", 1, 3), pick("b", 2, 7)])).toBe(8);
  });
});

describe("scoringFromSettings", () => {
  it("prefers draft metadata and otherwise uses reception points", () => {
    expect(scoringFromSettings("ppr")).toBe("ppr");
    expect(scoringFromSettings("half_ppr")).toBe("half_ppr");
    expect(scoringFromSettings("std")).toBe("std");
    expect(scoringFromSettings("custom", 1)).toBe("ppr");
    expect(scoringFromSettings(null, 0.5)).toBe("half_ppr");
    expect(scoringFromSettings(undefined, 0)).toBe("std");
    expect(scoringFromSettings(undefined)).toBe("std");
  });
});

describe("league shape helpers", () => {
  it("detects auction, dynasty, taxi, and superflex", () => {
    expect(isAuction("auction")).toBe(true);
    expect(isAuction("snake")).toBe(false);
    expect(isDynastyLeague({ type: 2 })).toBe(true);
    expect(isDynastyLeague({ type: "2" })).toBe(true);
    expect(isDynastyLeague({ taxi_slots: 2 })).toBe(true);
    expect(isDynastyLeague({ type: 0, taxi_slots: 0 })).toBe(false);
    expect(isDynastyLeague()).toBe(false);
    expect(isSuperflex(["QB", "SUPER_FLEX"])).toBe(true);
    expect(isSuperflex(["Q/W/R/T"])).toBe(true);
    expect(isSuperflex(["SUPERFLEX"])).toBe(true);
    expect(isSuperflex(["QB", "FLEX"])).toBe(false);
  });

  it("flags dynasty when taxi slots are present", () => {
    expect(detectUnsupported({ draftType: "snake", leagueSettings: { taxi_slots: 1 } })).toBe(
      "dynasty",
    );
  });
});

describe("player helpers", () => {
  it("builds a name from full_name or first/last", () => {
    expect(playerName(undefined, "x")).toBe("x");
    expect(playerName(player("p", "WR", 1, { full_name: "A.J. Brown" }), "p")).toBe(
      "A.J. Brown",
    );
    expect(
      playerName(player("p", "WR", 1, { first_name: "Ja'Marr", last_name: "Chase" }), "p"),
    ).toBe("Ja'Marr Chase");
  });

  it("treats missing search_rank as 9999", () => {
    expect(sleeperRankValue(player("p", "WR", 12))).toBe(12);
    expect(sleeperRankValue(player("p", "WR", 0))).toBe(9999);
    expect(sleeperRankValue(undefined)).toBe(9999);
  });

  it("formats skill-position depth and skips invalid values", () => {
    expect(depthLabel("WR", 1)).toBe("WR1");
    expect(depthLabel("K", 1)).toBeNull();
    expect(depthLabel("RB", 0)).toBeNull();
    expect(depthLabel("RB", "")).toBeNull();
    expect(depthLabel(undefined, 1)).toBeNull();
  });
});

describe("injury helpers", () => {
  it("scores IR/PUP higher than questionable", () => {
    expect(injuryPenalty("IR")).toBe(2.5);
    expect(injuryPenalty("PUP")).toBe(2.5);
    expect(injuryPenalty("Out")).toBe(2.0);
    expect(injuryPenalty("Suspended")).toBe(2.0);
    expect(injuryPenalty("Doubtful")).toBe(1.0);
    expect(injuryPenalty("Questionable")).toBe(0.35);
    expect(injuryPenalty(null)).toBe(0);
  });

  it("builds a reason from status, body part, and practice", () => {
    const injured = toPlayerView(
      player("hurt", "WR", 8, {
        injury_status: "Questionable",
        injury_body_part: "hamstring",
        practice_participation: "Did Not Participate",
      }),
      "hurt",
    );
    expect(injuryReason(injured)).toBe("Questionable · hamstring · DNP");
    expect(injuryReason(toPlayerView(player("ok", "WR", 8), "ok"))).toBeNull();
    expect(
      injuryReason(
        toPlayerView(
          player("status", "WR", 8, { injury_status: "Questionable" }),
          "status",
        ),
      ),
    ).toBeNull();
  });

  it("uses notes when body part is missing and ignores full practice", () => {
    const view = toPlayerView(
      player("hurt", "WR", 8, {
        injury_status: "Out",
        injury_notes: "Ankle sprain, week-to-week",
        practice_participation: "Full",
      }),
      "hurt",
    );
    expect(injuryReason(view)).toBe("Out · Ankle sprain, week-to-week");
  });
});

describe("fillRosterSlots", () => {
  it("fills dedicated slots, then flex/superflex, then bench", () => {
    const players: Record<string, SleeperPlayer> = {
      qb1: player("qb1", "QB", 18),
      qb2: player("qb2", "QB", 25),
      wr1: player("wr1", "WR", 8),
      wr2: player("wr2", "WR", 12),
      wr3: player("wr3", "WR", 30),
      rb1: player("rb1", "RB", 4),
    };
    const slots = fillRosterSlots(
      [
        pick("qb1", 1, 1),
        pick("qb2", 1, 2),
        pick("wr1", 1, 3),
        pick("wr2", 1, 4),
        pick("wr3", 1, 5),
        pick("rb1", 1, 6),
      ],
      ["QB", "RB", "WR", "FLEX", "SUPER_FLEX", "BN", "IR"],
      players,
    );
    expect(slots.find((slot) => slot.slot === "QB")?.player?.playerId).toBe("qb1");
    expect(slots.find((slot) => slot.slot === "SUPER_FLEX")?.player?.playerId).toBe("qb2");
    expect(slots.find((slot) => slot.slot === "WR")?.player?.playerId).toBe("wr1");
    expect(slots.find((slot) => slot.slot === "FLEX")?.player?.playerId).toBe("wr2");
    expect(slots.find((slot) => slot.slot === "BN")?.player?.playerId).toBe("wr3");
    expect(slots.find((slot) => slot.slot === "IR")?.player).toBeNull();
    expect(slots.find((slot) => slot.slot === "RB")?.player?.playerId).toBe("rb1");
  });
});

describe("invertDraftOrder and userPicksForRoster", () => {
  it("inverts slot maps and filters a roster including string ids", () => {
    expect(invertDraftOrder(null)).toEqual({});
    expect(invertDraftOrder({ u1: 1, u2: 3 })).toEqual({ 1: "u1", 3: "u2" });
    const picks = [pick("a", 1, 1), { ...pick("b", 2, 2), roster_id: "1" }, pick("c", 3, 3)];
    expect(userPicksForRoster(picks, 1).map((entry) => entry.player_id)).toEqual(["a", "b"]);
  });
});

describe("beforeYourPickSummary", () => {
  const rosterPositions = ["QB", "RB", "RB", "WR", "WR", "TE", "FLEX", "BN"];

  it("is null when the user is on the clock", () => {
    expect(
      beforeYourPickSummary({
        ...twelveTeamSnake,
        pickNo: 1,
        scoringType: "ppr",
        rosterPositions,
        userRosterId: 1,
        picks: [],
        players: {},
        picksUntilUser: 0,
      }),
    ).toBeNull();
  });

  it("summarizes starter holes for the managers picking before you", () => {
    const players = {
      r1qb: player("r1qb", "QB", 50),
      r1wr1: player("r1wr1", "WR", 51),
      r1wr2: player("r1wr2", "WR", 52),
      r1te: player("r1te", "TE", 53),
      r1flex: player("r1flex", "WR", 54),
      r2qb: player("r2qb", "QB", 55),
      r2wr1: player("r2wr1", "WR", 56),
      r2wr2: player("r2wr2", "WR", 57),
      r2te: player("r2te", "TE", 58),
      r2flex: player("r2flex", "WR", 59),
    };
    const summary = beforeYourPickSummary({
      ...twelveTeamSnake,
      pickNo: 1,
      scoringType: "std",
      rosterPositions,
      userRosterId: 3,
      picksUntilUser: 2,
      players,
      picks: [
        pick("r1qb", 1, 10),
        pick("r1wr1", 1, 11),
        pick("r1wr2", 1, 12),
        pick("r1te", 1, 13),
        pick("r1flex", 1, 14),
        pick("r2qb", 2, 15),
        pick("r2wr1", 2, 16),
        pick("r2wr2", 2, 17),
        pick("r2te", 2, 18),
        pick("r2flex", 2, 19),
      ],
    });
    expect(summary).toContain("Before your pick:");
    expect(summary).toContain("still need RB");
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

  it("returns no picks for an auction draft", () => {
    expect(recommend(input({ draftType: "auction" }))).toEqual([]);
  });

  it("uses best-available copy when no hole or ADP reason applies", () => {
    const recs = recommend(
      input({
        rosterPositions: ["BN"],
        players: { wr1: player("wr1", "WR", 8) },
      }),
    );
    expect(recs[0].reasons).toContain("Best available on the board");
  });

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
    const players = {
      qb1: player("qb1", "QB", 18),
      qb2: player("qb2", "QB", 45),
      wrA: player("wrA", "WR", 20),
      wrB: player("wrB", "WR", 22),
      wr1: player("wr1", "WR", 40),
    };
    const filled = [pick("qb1", 1, 12), pick("wrA", 1, 13), pick("wrB", 1, 14)];
    const oneQb = recommend(
      input({
        rosterPositions,
        picks: filled,
        pickNo: 25,
        players,
      }),
    );
    const superflex = recommend(
      input({
        rosterPositions: [...rosterPositions, "SUPER_FLEX"],
        picks: filled,
        pickNo: 25,
        players,
      }),
    );
    expect(oneQb[0].player.playerId).toBe("wr1");
    expect(superflex[0].player.playerId).toBe("qb2");
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

  it("raises an RB over a similar-ADP WR when upcoming teams still need RB", () => {
    const filled = {
      r1qb: player("r1qb", "QB", 50),
      r1wr1: player("r1wr1", "WR", 51),
      r1wr2: player("r1wr2", "WR", 52),
      r1te: player("r1te", "TE", 53),
      r1flex: player("r1flex", "WR", 54),
      r2qb: player("r2qb", "QB", 55),
      r2wr1: player("r2wr1", "WR", 56),
      r2wr2: player("r2wr2", "WR", 57),
      r2te: player("r2te", "TE", 58),
      r2flex: player("r2flex", "WR", 59),
      rb1: player("rb1", "RB", 20),
      wr1: player("wr1", "WR", 20),
    };
    const recs = recommend(
      input({
        userRosterId: 3,
        pickNo: 1,
        picksUntilUser: 2,
        scoringType: "std",
        players: filled,
        picks: [
          pick("r1qb", 1, 10),
          pick("r1wr1", 1, 11),
          pick("r1wr2", 1, 12),
          pick("r1te", 1, 13),
          pick("r1flex", 1, 14),
          pick("r2qb", 2, 15),
          pick("r2wr1", 2, 16),
          pick("r2wr2", 2, 17),
          pick("r2te", 2, 18),
          pick("r2flex", 2, 19),
        ],
      }),
    );
    expect(recs[0].player.playerId).toBe("rb1");
    expect(recs[0].reasons).toContain("2 of the next 2 picks still need RB");
  });

  it("tags the last WR before an 8+ ADP gap", () => {
    const recs = recommend(
      input({
        pickNo: 10,
        players: {
          wrA: player("wrA", "WR", 10),
          wrB: player("wrB", "WR", 12),
          wrC: player("wrC", "WR", 30),
          rb1: player("rb1", "RB", 4),
        },
      }),
    );
    const wrB = recs.find((rec) => rec.player.playerId === "wrB");
    expect(wrB?.reasons).toContain("Last WR before a 18-pick ADP gap");
  });

  it("boosts a WR who stacks with the user's QB", () => {
    const recs = recommend(
      input({
        pickNo: 25,
        picks: [pick("phiqb", 1, 12)],
        players: {
          phiqb: player("phiqb", "QB", 18, {
            first_name: "Jalen",
            last_name: "Hurts",
            full_name: "Jalen Hurts",
            team: "PHI",
          }),
          phiwr: player("phiwr", "WR", 40, { team: "PHI", full_name: "A.J. Brown" }),
          otherwr: player("otherwr", "WR", 39, { team: "KC", full_name: "Xavier Worthy" }),
        },
      }),
    );
    const stacked = recs.find((rec) => rec.player.playerId === "phiwr");
    expect(stacked?.reasons).toContain("Stacks with Jalen Hurts");
    expect(recs[0].player.playerId).toBe("phiwr");
  });

  it("ranks an IR WR behind a healthy WR of similar ADP", () => {
    const recs = recommend(
      input({
        pickNo: 1,
        players: {
          healthy: player("healthy", "WR", 8, { full_name: "Healthy WR" }),
          hurt: player("hurt", "WR", 8, {
            full_name: "Hurt WR",
            injury_status: "IR",
            injury_body_part: "knee",
          }),
        },
      }),
    );
    expect(recs[0].player.playerId).toBe("healthy");
    const injured = recs.find((rec) => rec.player.playerId === "hurt");
    expect(injured).toBeDefined();
    expect(recs.findIndex((rec) => rec.player.playerId === "hurt")).toBeGreaterThan(0);
  });

  it("adds a Questionable hamstring reason", () => {
    const recs = recommend(
      input({
        pickNo: 1,
        players: {
          wr1: player("wr1", "WR", 8, {
            full_name: "Ja'Marr Chase",
            injury_status: "Questionable",
            injury_body_part: "hamstring",
          }),
        },
      }),
    );
    expect(recs[0].reasons).toContain("Questionable · hamstring");
  });

  it("ranks a workhorse WR1 with a strong season over a similar-ADP backup", () => {
    const extras: EnrichmentIndex = new Map([
      [
        "star",
        {
          adp: 24,
          adpStdev: 3,
          byeWeek: 8,
          lastSeason: lastSeason(280, 17, 88),
        },
      ],
      [
        "backup",
        {
          adp: 24,
          adpStdev: 3,
          byeWeek: 9,
          lastSeason: lastSeason(140, 17, 28),
        },
      ],
    ]);
    const recs = recommend(
      input({
        pickNo: 25,
        extras,
        players: {
          star: player("star", "WR", 80, {
            full_name: "Star WR",
            depth_chart_order: 1,
          }),
          backup: player("backup", "WR", 80, {
            full_name: "Backup WR",
            depth_chart_order: 3,
          }),
        },
      }),
    );
    expect(recs[0].player.playerId).toBe("star");
    expect(recs[0].reasons).toContain("Strong last season");
    expect(recs[0].reasons).toContain("Workhorse snap share (88%)");
    expect(recs[0].reasons).toContain("Depth-chart WR1");
    const backup = recs.find((rec) => rec.player.playerId === "backup");
    expect(backup?.reasons).toContain("Limited snaps last year (28%)");
  });

  it("penalizes a third starter on the same bye week", () => {
    const extras: EnrichmentIndex = new Map([
      ["rbA", extra({ byeWeek: 7 })],
      ["wrA", extra({ byeWeek: 7 })],
      ["clustered", extra({ adp: 30, byeWeek: 7 })],
      ["spread", extra({ adp: 30, byeWeek: 12 })],
    ]);
    const recs = recommend(
      input({
        pickNo: 25,
        extras,
        picks: [pick("rbA", 1, 1), pick("wrA", 1, 2)],
        players: {
          rbA: player("rbA", "RB", 8),
          wrA: player("wrA", "WR", 10),
          clustered: player("clustered", "WR", 80, { full_name: "Bye Twin" }),
          spread: player("spread", "WR", 80, { full_name: "Off Bye" }),
        },
      }),
    );
    expect(recs[0].player.playerId).toBe("spread");
    const clustered = recs.find((rec) => rec.player.playerId === "clustered");
    expect(clustered?.reasons).toContain("Would be 3 starters on bye 7");
  });

  it("trusts a tight ADP more than a wide one when both are falling", () => {
    const extras: EnrichmentIndex = new Map([
      ["consensus", extra({ adp: 10, adpStdev: 2 })],
      ["volatile", extra({ adp: 10, adpStdev: 14 })],
    ]);
    const recs = recommend(
      input({
        pickNo: 30,
        extras,
        players: {
          consensus: player("consensus", "WR", 80, { full_name: "Consensus WR" }),
          volatile: player("volatile", "WR", 80, { full_name: "Volatile WR" }),
        },
      }),
    );
    expect(recs[0].player.playerId).toBe("consensus");
    expect(recs[0].reasons).toContain("Falling vs ADP");
  });
});

function lastSeason(
  fantasyPts: number,
  games = 17,
  snapPct: number | null = 80,
): LastSeasonStats {
  return { season: 2025, games, fantasyPts, snapPct, line: "" };
}

function extra(partial: Partial<PlayerExtras>): PlayerExtras {
  return {
    adp: partial.adp ?? null,
    adpStdev: partial.adpStdev ?? null,
    byeWeek: partial.byeWeek ?? null,
    lastSeason: partial.lastSeason ?? null,
  };
}

describe("board enrichment scores", () => {
  it("scores last-season PPG against a scoring-aware baseline", () => {
    const wr = toPlayerView(player("wr", "WR", 8), "wr", undefined, new Map([
      ["wr", extra({ lastSeason: lastSeason(280, 17, 88) })],
    ]));
    expect(productionScore(wr, "ppr")).toBeCloseTo((280 / 17 - 11.5) / 6, 5);
    expect(productionScore(wr, "std")).toBeGreaterThan(productionScore(wr, "ppr"));
    expect(productionScore(toPlayerView(player("wr", "WR", 8), "wr"), "ppr")).toBe(0);
    const short = toPlayerView(player("wr", "WR", 8), "wr", undefined, new Map([
      ["wr", extra({ lastSeason: lastSeason(80, 4, 90) })],
    ]));
    expect(productionScore(short, "ppr")).toBe(0);
  });

  it("treats high snap share as a boost and punishes veteran backups", () => {
    const workhorse = toPlayerView(player("wr", "WR", 8), "wr", undefined, new Map([
      ["wr", extra({ lastSeason: lastSeason(200, 17, 85) })],
    ]));
    const backup = toPlayerView(player("wr", "WR", 8), "wr", undefined, new Map([
      ["wr", extra({ lastSeason: lastSeason(80, 17, 22) })],
    ]));
    const rookie = toPlayerView(
      player("wr", "WR", 8, { years_exp: 0 }),
      "wr",
      undefined,
      new Map([["wr", extra({ lastSeason: lastSeason(40, 17, 22) })]]),
    );
    expect(snapScore(workhorse)).toBe(0.5);
    expect(snapScore(backup)).toBe(-0.45);
    expect(snapScore(rookie)).toBe(0);
  });

  it("parses depth-chart order and scores WR1 above WR3", () => {
    expect(depthOrder("WR1")).toBe(1);
    expect(depthOrder("RB3")).toBe(3);
    expect(depthOrder(null)).toBeNull();
    expect(depthScore(toPlayerView(player("wr", "WR", 8, { depth_chart_order: 1 }), "wr"))).toBe(
      0.4,
    );
    expect(depthScore(toPlayerView(player("wr", "WR", 8, { depth_chart_order: 3 }), "wr"))).toBe(
      -0.25,
    );
    expect(depthScore(toPlayerView(player("wr", "WR", 8), "wr"))).toBe(0);
  });

  it("dampens falling-vs-ADP when ADP spread is wide", () => {
    expect(adjustValueForStdev(2, 2)).toBeCloseTo(2.16, 5);
    expect(adjustValueForStdev(2, 12)).toBeLessThan(2);
    expect(adjustValueForStdev(2, null)).toBe(2);
  });

  it("counts starter byes and ignores bench", () => {
    const players = {
      wr1: player("wr1", "WR", 8),
      wr2: player("wr2", "WR", 12),
      rb1: player("rb1", "RB", 4),
    };
    const extras: EnrichmentIndex = new Map([
      ["wr1", extra({ byeWeek: 7 })],
      ["wr2", extra({ byeWeek: 7 })],
      ["rb1", extra({ byeWeek: 10 })],
    ]);
    const roster = fillRosterSlots(
      [pick("wr1", 1, 1), pick("wr2", 1, 2), pick("rb1", 1, 3)],
      ["WR", "WR", "BN"],
      players,
      extras,
    );
    const counts = starterByeCounts(roster);
    expect(counts.get(7)).toBe(2);
    expect(counts.get(10)).toBeUndefined();
    const clustered = toPlayerView(player("wr3", "WR", 20), "wr3", undefined, new Map([
      ["wr3", extra({ byeWeek: 7 })],
    ]));
    expect(byeClusterPenalty(clustered, 2)).toBe(0.85);
    expect(byeClusterPenalty(clustered, 0)).toBe(0);
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
    expect(view.espnId).toBeNull();
  });

  it("copies ESPN and injury fields", () => {
    const view = toPlayerView(
      player("r1", "RB", 40, {
        espn_id: 4241463,
        injury_status: "Questionable",
        injury_body_part: "hamstring",
        injury_notes: "Limited in practice",
        practice_participation: "Limited",
      }),
      "r1",
    );
    expect(view.espnId).toBe("4241463");
    expect(view.injuryStatus).toBe("Questionable");
    expect(view.injuryBodyPart).toBe("hamstring");
    expect(view.injuryNotes).toBe("Limited in practice");
    expect(view.practiceParticipation).toBe("Limited");
  });
});
