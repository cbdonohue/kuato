import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPick,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

vi.mock("./sleeper", () => ({
  getUser: vi.fn(),
  getDraft: vi.fn(),
  getDraftPicks: vi.fn(),
  getTradedPicks: vi.fn(),
  getNflPlayers: vi.fn(),
  getLeague: vi.fn(),
  getLeagueUsers: vi.fn(),
  getLeagueRosters: vi.fn(),
}));
vi.mock("./ffc", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./ffc")>();
  return { ...actual, getFfcAdp: vi.fn() };
});
vi.mock("./nflverse", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./nflverse")>();
  return { ...actual, getNflverseSeason: vi.fn() };
});
vi.mock("./news", () => ({
  loadRecStories: vi.fn(),
}));
vi.mock("./coach", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./coach")>();
  return { ...actual, getCoachNote: vi.fn() };
});

import {
  availableBoard,
  buildClock,
  buildLiveState,
  displayNameFor,
  draftName,
  resolvePickManager,
  resolveUserSlot,
  rosterPositionsFor,
} from "./live";
import { getCoachNote, shouldAskCoach } from "./coach";
import { EMPTY_NFLVERSE, getNflverseSeason } from "./nflverse";
import { loadRecStories } from "./news";
import { getFfcAdp } from "./ffc";
import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getNflPlayers,
  getTradedPicks,
  getUser,
} from "./sleeper";

const self: SleeperUser = {
  user_id: "u1",
  username: "brian",
  display_name: "Brian",
  avatar: null,
};

const users: SleeperLeagueUser[] = [
  { user_id: "u1", display_name: "Brian", username: "brian" },
  { user_id: "u2", display_name: "Ada", username: "ada" },
];

function draft(overrides: Partial<SleeperDraft> = {}): SleeperDraft {
  return {
    draft_id: "d1",
    league_id: "l1",
    type: "snake",
    status: "drafting",
    sport: "nfl",
    season: "2026",
    start_time: null,
    settings: {
      teams: 4,
      rounds: 3,
      slots_qb: 1,
      slots_rb: 1,
      slots_wr: 1,
      slots_te: 0,
      slots_flex: 1,
      slots_super_flex: 0,
      slots_k: 0,
      slots_def: 0,
      slots_bn: 1,
    },
    metadata: { scoring_type: "ppr", name: "Home League" },
    draft_order: { u1: 1, u2: 2, u3: 3, u4: 4 },
    slot_to_roster_id: { "1": 1, "2": 2, "3": 3, "4": 4 },
    ...overrides,
  };
}

function pick(
  playerId: string,
  rosterId: number,
  pickNo: number,
  extras: Partial<SleeperPick> = {},
): SleeperPick {
  return {
    player_id: playerId,
    picked_by: extras.picked_by ?? `u${rosterId}`,
    roster_id: rosterId,
    round: Math.ceil(pickNo / 4),
    draft_slot: extras.draft_slot ?? ((pickNo - 1) % 4) + 1,
    pick_no: pickNo,
    draft_id: "d1",
    ...extras,
  };
}

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
    full_name: extras.full_name ?? `${id} ${position}`,
    position,
    team: extras.team ?? "KC",
    status: extras.status ?? "Active",
    search_rank: rank,
    ...extras,
  };
}

describe("draftName and rosterPositionsFor", () => {
  it("prefers draft metadata, then the league name", () => {
    expect(draftName(draft(), { league_id: "l1", name: "League", status: "in_season", roster_positions: [] })).toBe(
      "Home League",
    );
    expect(
      draftName(draft({ metadata: null }), {
        league_id: "l1",
        name: "League",
        status: "in_season",
        roster_positions: [],
      }),
    ).toBe("League");
    expect(draftName(draft({ metadata: null }), null)).toBe("Draft d1");
  });

  it("uses league roster positions when present", () => {
    const league: SleeperLeague = {
      league_id: "l1",
      name: "League",
      status: "in_season",
      roster_positions: ["QB", "RB", "SUPER_FLEX"],
    };
    expect(rosterPositionsFor(draft(), league)).toEqual(["QB", "RB", "SUPER_FLEX"]);
  });

  it("builds slots from draft settings when the league has none", () => {
    expect(rosterPositionsFor(draft(), null)).toEqual(["QB", "RB", "WR", "FLEX", "BN"]);
  });
});

describe("resolveUserSlot", () => {
  const rosters: SleeperRoster[] = [
    { roster_id: 1, owner_id: "u1" },
    { roster_id: 2, owner_id: "u2" },
  ];

  it("uses draft_order when the user is mapped", () => {
    expect(resolveUserSlot(self, draft(), rosters, [])).toEqual({ slot: 1, rosterId: 1 });
  });

  it("falls back to the owned roster when draft_order is missing", () => {
    expect(
      resolveUserSlot(self, draft({ draft_order: null }), rosters, []),
    ).toEqual({ slot: 1, rosterId: 1 });
  });

  it("uses a pick the user already made", () => {
    expect(
      resolveUserSlot(
        self,
        draft({ draft_order: null, slot_to_roster_id: {} }),
        [],
        [pick("rb1", 1, 1, { picked_by: "u1", draft_slot: 1 })],
      ),
    ).toEqual({ slot: 1, rosterId: 1 });
  });

  it("returns nulls when the user is not in the draft", () => {
    expect(
      resolveUserSlot(
        { ...self, user_id: "ghost" },
        draft({ draft_order: { u2: 2 } }),
        rosters,
        [],
      ),
    ).toEqual({ slot: null, rosterId: null });
  });
});

describe("displayNameFor and resolvePickManager", () => {
  it("labels self, league users, bots, and unknown managers", () => {
    expect(displayNameFor("u1", users, self)).toBe("Brian");
    expect(displayNameFor("u2", users, self)).toBe("Ada");
    expect(displayNameFor("u9", users, self)).toBe("u9");
    expect(displayNameFor(null, users, self, 3)).toBe("Bot · Slot 3");
    expect(displayNameFor(null, users, self)).toBe("Unknown manager");
  });

  it("marks a pick as yours from picked_by or matching roster", () => {
    const opts = {
      user: self,
      users,
      rosters: [{ roster_id: 1, owner_id: "u1" }],
      slotToUser: { 1: "u1", 2: "u2" },
      userRosterId: 1,
    };
    expect(resolvePickManager(pick("rb1", 1, 1, { picked_by: "u1" }), opts).isYou).toBe(true);
    expect(
      resolvePickManager(pick("wr1", 1, 2, { picked_by: "" }), opts),
    ).toMatchObject({ isYou: true, displayName: "Brian" });
    expect(resolvePickManager(pick("te1", 2, 3, { picked_by: "u2" }), opts).isYou).toBe(false);
  });
});

describe("buildClock", () => {
  const clockOpts = {
    draft: draft(),
    picks: [] as SleeperPick[],
    user: self,
    users,
    rosters: [
      { roster_id: 1, owner_id: "u1" },
      { roster_id: 2, owner_id: "u2" },
    ],
    userRosterId: 1,
    tradedPicks: [],
  };

  it("marks the user on the clock at pick 1", () => {
    const clock = buildClock(clockOpts);
    expect(clock.pickNo).toBe(1);
    expect(clock.onTheClock?.isYou).toBe(true);
    expect(clock.picksUntilUser).toBe(0);
    expect(clock.nextUserPickNo).toBe(1);
  });

  it("counts picks until the user after someone else is on the clock", () => {
    const clock = buildClock({
      ...clockOpts,
      picks: [pick("rb1", 1, 1)],
    });
    expect(clock.pickNo).toBe(2);
    expect(clock.onTheClock?.isYou).toBe(false);
    expect(clock.picksUntilUser).toBe(6);
    expect(clock.nextUserPickNo).toBe(8);
  });

  it("clears the clock when the draft is finished", () => {
    const picks = Array.from({ length: 12 }, (_, i) => pick(`p${i}`, (i % 4) + 1, i + 1));
    const clock = buildClock({ ...clockOpts, picks });
    expect(clock.onTheClock).toBeNull();
    expect(clock.picksUntilUser).toBeNull();
    expect(clock.pickNo).toBe(12);
  });
});

describe("availableBoard", () => {
  it("drops drafted, inactive, and low-rank players and sorts by rank", () => {
    const board = availableBoard(
      [pick("taken", 1, 1)],
      {
        taken: player("taken", "RB", 1),
        wr1: player("wr1", "WR", 8),
        qb1: player("qb1", "QB", 20),
        ir: player("ir", "WR", 10, { status: "Inactive" }),
        ol: player("ol", "OL", 5),
        deep: player("deep", "WR", 400),
        def: player("def", "DEF", 120, { status: "Inactive" }),
      },
    );
    expect(board.map((entry) => entry.playerId)).toEqual(["wr1", "qb1", "def"]);
  });
});

describe("buildLiveState", () => {
  beforeEach(() => {
    vi.mocked(getUser).mockResolvedValue(self);
    vi.mocked(getDraft).mockResolvedValue(draft());
    vi.mocked(getDraftPicks).mockResolvedValue([]);
    vi.mocked(getTradedPicks).mockResolvedValue([]);
    vi.mocked(getNflPlayers).mockResolvedValue({
      rb1: player("rb1", "RB", 4, { full_name: "Derrick Henry" }),
      wr1: player("wr1", "WR", 8, { full_name: "A.J. Brown" }),
      qb1: player("qb1", "QB", 18, { full_name: "Jalen Hurts" }),
    });
    vi.mocked(getLeague).mockResolvedValue({
      league_id: "l1",
      name: "Home League",
      status: "drafting",
      roster_positions: ["QB", "RB", "WR", "FLEX", "BN"],
      scoring_settings: { rec: 1 },
    });
    vi.mocked(getLeagueUsers).mockResolvedValue(users);
    vi.mocked(getLeagueRosters).mockResolvedValue([
      { roster_id: 1, owner_id: "u1" },
      { roster_id: 2, owner_id: "u2" },
    ]);
    vi.mocked(getFfcAdp).mockResolvedValue([]);
    vi.mocked(getNflverseSeason).mockResolvedValue(EMPTY_NFLVERSE);
    vi.mocked(loadRecStories).mockResolvedValue({ stories: [], sources: [] });
    vi.mocked(getCoachNote).mockResolvedValue("Take the RB.");
  });

  it("assembles clock, recs, coach, and available board for a live snake draft", async () => {
    const state = await buildLiveState("d1", "brian");
    expect(state.user.username).toBe("brian");
    expect(state.draft.scoringType).toBe("ppr");
    expect(state.unsupported).toBeNull();
    expect(state.clock.onTheClock?.isYou).toBe(true);
    expect(state.recommendations.length).toBeGreaterThan(0);
    expect(state.coachNote).toBe("Take the RB.");
    expect(state.available.map((entry) => entry.playerId)).toEqual(["rb1", "wr1", "qb1"]);
    expect(shouldAskCoach(state.clock.picksUntilUser)).toBe(true);
    expect(getCoachNote).toHaveBeenCalled();
    expect(loadRecStories).toHaveBeenCalled();
  });

  it("skips recommendations for an auction draft", async () => {
    vi.mocked(getDraft).mockResolvedValue(draft({ type: "auction" }));
    const state = await buildLiveState("d1", "brian");
    expect(state.unsupported).toBe("auction");
    expect(state.recommendations).toEqual([]);
    expect(state.coachNote).toBeNull();
  });

  it("continues when league lookups fail", async () => {
    vi.mocked(getLeague).mockRejectedValue(new Error("league down"));
    const state = await buildLiveState("d1", "brian");
    expect(state.leagueName).toBe("Home League");
    expect(state.recommendations.length).toBeGreaterThan(0);
  });

  it("hides recommendations when the user is not seated and still lists recent picks", async () => {
    vi.mocked(getUser).mockResolvedValue({
      user_id: "ghost",
      username: "ghost",
      display_name: "Ghost",
      avatar: null,
    });
    vi.mocked(getDraft).mockResolvedValue(draft({ draft_order: { u2: 2 } }));
    vi.mocked(getDraftPicks).mockResolvedValue([
      pick("rb1", 2, 1, { picked_by: "u2" }),
    ]);
    const state = await buildLiveState("d1", "ghost");
    expect(state.recommendations).toEqual([]);
    expect(state.coachNote).toBeNull();
    expect(state.recentPicks[0]).toMatchObject({
      pickNo: 1,
      pickedByName: "Ada",
      isYou: false,
    });
  });
});
