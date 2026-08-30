import { describe, expect, it } from "vitest";
import {
  actionTitle,
  buildAiPrompt,
  byeClusters,
  draftContext,
  findPlayer,
  formatPlayerLine,
  parseAiRequest,
  suggestedQuestions,
  tokenBudget,
} from "./ai";
import { shouldAskCoach } from "./coach";
import type { LiveState, PlayerView } from "./types";

function player(
  id: string,
  extras: Partial<PlayerView> = {},
): PlayerView {
  return {
    playerId: id,
    name: extras.name ?? id,
    position: extras.position ?? "WR",
    team: extras.team ?? "KC",
    rank: extras.rank ?? 20,
    sleeperRank: extras.sleeperRank ?? 20,
    adp: extras.adp ?? 20,
    adpStdev: extras.adpStdev ?? null,
    byeWeek: extras.byeWeek ?? 10,
    age: extras.age ?? 26,
    yearsExp: extras.yearsExp ?? 4,
    rookie: extras.rookie ?? false,
    depth: extras.depth ?? "WR1",
    lastSeason: extras.lastSeason ?? {
      season: 2025,
      games: 17,
      fantasyPts: 220,
      snapPct: 90,
      line: "90-1200-10",
    },
    injuryStatus: extras.injuryStatus ?? null,
    injuryNotes: extras.injuryNotes ?? null,
    injuryBodyPart: extras.injuryBodyPart ?? null,
    practiceParticipation: extras.practiceParticipation ?? null,
    espnId: extras.espnId ?? null,
  };
}

function sampleState(overrides: Partial<LiveState> = {}): LiveState {
  const chase = player("401", { name: "Ja'Marr Chase", position: "WR", adp: 2, rank: 2 });
  const kelce = player("te1", { name: "Travis Kelce", position: "TE", adp: 48, rank: 48 });
  const bijan = player("rb1", {
    name: "Bijan Robinson",
    position: "RB",
    team: "ATL",
    adp: 4,
    rank: 4,
    byeWeek: 5,
  });
  return {
    user: { user_id: "u1", username: "brian", display_name: "Brian", avatar: null },
    draft: {
      draftId: "d1",
      name: "Test Draft",
      type: "snake",
      status: "drafting",
      season: "2026",
      teams: 12,
      rounds: 15,
      scoringType: "ppr",
      isSuperflex: false,
    },
    leagueName: "Thursday Night",
    unsupported: null,
    clock: {
      pickNo: 37,
      round: 4,
      totalPicks: 180,
      onTheClock: {
        userId: "u2",
        displayName: "Sam",
        slot: 1,
        rosterId: 1,
        isYou: false,
      },
      picksUntilUser: 2,
      nextUserPickNo: 39,
    },
    roster: [
      { slot: "QB", player: null },
      { slot: "RB", player: bijan },
      { slot: "RB", player: null },
      { slot: "WR", player: chase },
      { slot: "WR", player: null },
      { slot: "TE", player: null },
      { slot: "FLEX", player: null },
      { slot: "BN", player: null },
    ],
    recommendations: [
      { player: kelce, reasons: ["Fills a starter hole"] },
      { player: chase, reasons: ["Falling vs ADP"] },
    ],
    stories: [
      {
        playerId: "te1",
        playerName: "Travis Kelce",
        position: "TE",
        source: "ESPN",
        headline: "Kelce expected to play week 1",
        publishedAt: Date.now(),
        age: "2h ago",
        url: "https://example.com",
      },
    ],
    newsSources: ["ESPN"],
    coachNote: null,
    aiEnabled: true,
    recentPicks: [
      {
        pickNo: 36,
        round: 3,
        player: player("wr2", { name: "Amon-Ra St. Brown", position: "WR", team: "DET" }),
        pickedByName: "Sam",
        isYou: false,
      },
    ],
    available: [kelce, chase],
    ...overrides,
  };
}

describe("parseAiRequest", () => {
  it("rejects missing or unknown actions", () => {
    expect(parseAiRequest(null).ok).toBe(false);
    expect(parseAiRequest({}).ok).toBe(false);
    expect(parseAiRequest({ action: "dance" }).ok).toBe(false);
  });

  it("requires a short question for ask", () => {
    expect(parseAiRequest({ action: "ask" }).ok).toBe(false);
    expect(parseAiRequest({ action: "ask", question: "   " }).ok).toBe(false);
    expect(
      parseAiRequest({ action: "ask", question: "x".repeat(401) }).ok,
    ).toBe(false);
    const ok = parseAiRequest({ action: "ask", question: "  Wait on TE?  " });
    expect(ok).toEqual({
      ok: true,
      value: { action: "ask", question: "Wait on TE?" },
    });
  });

  it("requires a player for scout and two distinct players for compare", () => {
    expect(parseAiRequest({ action: "scout" }).ok).toBe(false);
    expect(parseAiRequest({ action: "scout", playerId: "401" })).toEqual({
      ok: true,
      value: { action: "scout", playerId: "401" },
    });
    expect(parseAiRequest({ action: "compare", playerIds: ["a"] }).ok).toBe(false);
    expect(
      parseAiRequest({ action: "compare", playerIds: ["a", "a"] }).ok,
    ).toBe(false);
    expect(
      parseAiRequest({ action: "compare", playerIds: ["a", "b", "c"] }),
    ).toEqual({
      ok: true,
      value: { action: "compare", playerIds: ["a", "b"] },
    });
  });

  it("accepts review, briefing, and board with no extras", () => {
    expect(parseAiRequest({ action: "review" })).toEqual({
      ok: true,
      value: { action: "review" },
    });
    expect(parseAiRequest({ action: "briefing" }).ok).toBe(true);
    expect(parseAiRequest({ action: "board" }).ok).toBe(true);
  });
});

describe("suggestedQuestions", () => {
  it("leans on open starter holes and news", () => {
    const questions = suggestedQuestions(sampleState());
    expect(questions).toContain("Should I take a TE now or wait?");
    expect(questions).toContain("Do I need RB or WR more here?");
    expect(questions).toContain("Does any news change this pick?");
    expect(questions.length).toBeLessThanOrEqual(4);
  });

  it("mentions QB timing in superflex", () => {
    const questions = suggestedQuestions(
      sampleState({
        draft: {
          ...sampleState().draft,
          isSuperflex: true,
        },
        stories: [],
      }),
    );
    expect(questions).toContain("When should I take a QB?");
  });
});

describe("draft helpers", () => {
  it("formats players, finds them, and clusters byes", () => {
    const state = sampleState();
    const bijan = state.roster[1].player;
    expect(bijan).toBeTruthy();
    expect(formatPlayerLine(bijan!)).toContain("Bijan Robinson");
    expect(formatPlayerLine(bijan!)).toContain("ADP 4");
    expect(findPlayer(state, "te1")?.name).toBe("Travis Kelce");
    expect(findPlayer(state, "missing")).toBeNull();

    const clustered = sampleState({
      roster: [
        {
          slot: "WR",
          player: player("w1", { name: "Tyreek Hill", byeWeek: 6 }),
        },
        {
          slot: "RB",
          player: player("r1", { name: "De'Von Achane", byeWeek: 6, position: "RB" }),
        },
        { slot: "TE", player: player("t1", { name: "Solo", byeWeek: 9 }) },
      ],
    });
    expect(byeClusters(clustered.roster)).toEqual([
      "week 6: Tyreek Hill, De'Von Achane",
    ]);
  });

  it("puts league, holes, recs, and news into the shared context", () => {
    const context = draftContext(sampleState());
    expect(context).toContain("Thursday Night");
    expect(context).toContain("Scoring: ppr");
    expect(context).toContain("Open starter holes: QB, RB, WR, TE, FLEX");
    expect(context).toContain("Travis Kelce");
    expect(context).toContain("Kelce expected to play week 1");
    expect(context).toContain("The manager picks in 2 selection(s).");
  });
});

describe("buildAiPrompt", () => {
  it("includes the question for ask and names for scout/compare", () => {
    const state = sampleState();
    const ask = buildAiPrompt(
      { action: "ask", question: "Should I wait on TE?" },
      state,
    );
    expect(ask).toContain("Should I wait on TE?");
    expect(ask).toContain("Thursday Night");

    const scout = buildAiPrompt({ action: "scout", playerId: "te1" }, state);
    expect(scout).toContain("Travis Kelce");
    expect(scout).toContain("take now or wait");

    const compare = buildAiPrompt(
      { action: "compare", playerIds: ["te1", "401"] },
      state,
    );
    expect(compare).toContain("Travis Kelce");
    expect(compare).toContain("Ja'Marr Chase");
    expect(actionTitle({ action: "compare", playerIds: ["te1", "401"] }, state)).toBe(
      "Compare · Travis Kelce vs Ja'Marr Chase",
    );
  });

  it("uses a larger remaining board for sleepers and fades", () => {
    const extras = Array.from({ length: 30 }, (_, index) =>
      player(`p${index}`, { name: `Player ${index}`, adp: 50 + index, rank: 50 + index }),
    );
    const state = sampleState({ available: extras });
    const board = buildAiPrompt({ action: "board" }, state);
    expect(board).toContain("Player 29");
    expect(tokenBudget("board")).toBe(260);
    expect(tokenBudget("scout")).toBe(180);
  });
});

describe("shouldAskCoach", () => {
  it("only auto-prompts within two picks", () => {
    expect(shouldAskCoach(0)).toBe(true);
    expect(shouldAskCoach(2)).toBe(true);
    expect(shouldAskCoach(3)).toBe(false);
    expect(shouldAskCoach(null)).toBe(false);
  });
});
