import { afterEach, describe, expect, it, vi } from "vitest";
import { getCoachNote, hasLlmKey, rosterHoleLabels, shouldAskCoach } from "./coach";
import type { PlayerView, Recommendation } from "./types";

const originalOpenAi = process.env.OPENAI_API_KEY;
const originalAnthropic = process.env.ANTHROPIC_API_KEY;

afterEach(() => {
  if (originalOpenAi === undefined) delete process.env.OPENAI_API_KEY;
  else process.env.OPENAI_API_KEY = originalOpenAi;
  if (originalAnthropic === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = originalAnthropic;
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function rec(id: string, name = id): Recommendation {
  const player: PlayerView = {
    playerId: id,
    name,
    position: "RB",
    team: "BAL",
    rank: 4,
    sleeperRank: 4,
    adp: 4,
    adpStdev: 1,
    byeWeek: 7,
    age: 30,
    yearsExp: 9,
    rookie: false,
    depth: "RB1",
    lastSeason: {
      season: 2025,
      games: 17,
      fantasyPts: 300,
      snapPct: 85,
      line: "1921 rush, 16 TD",
    },
    injuryStatus: null,
    injuryNotes: null,
    injuryBodyPart: null,
    practiceParticipation: null,
    espnId: null,
  };
  return { player, reasons: ["Fills a starter hole"] };
}

describe("shouldAskCoach", () => {
  it("is true within two picks", () => {
    expect(shouldAskCoach(0)).toBe(true);
    expect(shouldAskCoach(2)).toBe(true);
    expect(shouldAskCoach(3)).toBe(false);
    expect(shouldAskCoach(null)).toBe(false);
  });
});

describe("hasLlmKey", () => {
  it("requires an OpenAI or Anthropic key", () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(hasLlmKey()).toBe(false);
    process.env.OPENAI_API_KEY = "sk-test";
    expect(hasLlmKey()).toBe(true);
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "ant-test";
    expect(hasLlmKey()).toBe(true);
  });
});

describe("rosterHoleLabels", () => {
  it("lists open starter slots and skips bench or IR", () => {
    expect(
      rosterHoleLabels([
        { slot: "QB", player: rec("qb1").player },
        { slot: "RB", player: null },
        { slot: "FLEX", player: null },
        { slot: "BN", player: null },
        { slot: "IR", player: null },
      ]),
    ).toEqual(["RB", "FLEX"]);
  });
});

describe("getCoachNote", () => {
  it("returns null without a key, when far from the clock, or with no recs", async () => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    expect(
      await getCoachNote({
        draftId: "d1",
        pickNo: 1,
        scoringType: "ppr",
        isSuperflex: false,
        leagueName: "Test",
        picksUntilUser: 0,
        rosterHoles: ["RB"],
        recommendations: [rec("rb1")],
      }),
    ).toBeNull();

    process.env.OPENAI_API_KEY = "sk-test";
    expect(
      await getCoachNote({
        draftId: "d1",
        pickNo: 1,
        scoringType: "ppr",
        isSuperflex: false,
        leagueName: "Test",
        picksUntilUser: 5,
        rosterHoles: ["RB"],
        recommendations: [rec("rb1")],
      }),
    ).toBeNull();
    expect(
      await getCoachNote({
        draftId: "d1",
        pickNo: 1,
        scoringType: "ppr",
        isSuperflex: false,
        leagueName: "Test",
        picksUntilUser: 0,
        rosterHoles: ["RB"],
        recommendations: [],
      }),
    ).toBeNull();
  });

  it("calls OpenAI, caches the note, and includes recs in the prompt", async () => {
    process.env.OPENAI_API_KEY = "sk-test";
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "  Take Henry now.  " } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const opts = {
      draftId: "openai-cache",
      pickNo: 12,
      scoringType: "ppr" as const,
      isSuperflex: false,
      leagueName: "Home League",
      picksUntilUser: 0,
      rosterHoles: ["RB"],
      demandSummary: "Before your pick: 2 still need RB.",
      stories: [
        {
          playerId: "rb1",
          playerName: "Derrick Henry",
          position: "RB",
          source: "ESPN",
          headline: "Henry limited Wednesday",
          publishedAt: 1,
          age: "1h ago",
          url: null,
        },
      ],
      recommendations: [rec("rb1", "Derrick Henry")],
    };

    expect(await getCoachNote(opts)).toBe("Take Henry now.");
    expect(await getCoachNote(opts)).toBe("Take Henry now.");
    expect(fetchMock).toHaveBeenCalledOnce();

    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as {
      messages: { content: string }[];
    };
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.openai.com/v1/chat/completions");
    expect(body.messages[0].content).toContain("The manager is on the clock.");
    expect(body.messages[0].content).toContain("Derrick Henry");
    expect(body.messages[0].content).toContain("Henry limited Wednesday");
    expect(body.messages[0].content).toContain("2 still need RB");
  });

  it("uses Anthropic when only that key is set and swallows failed calls", async () => {
    delete process.env.OPENAI_API_KEY;
    process.env.ANTHROPIC_API_KEY = "ant-test";
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ content: [{ type: "text", text: "Fade the kicker." }] }),
      })
      .mockResolvedValueOnce({ ok: false });
    vi.stubGlobal("fetch", fetchMock);

    expect(
      await getCoachNote({
        draftId: "anth-ok",
        pickNo: 20,
        scoringType: "half_ppr",
        isSuperflex: true,
        leagueName: "SF",
        picksUntilUser: 1,
        rosterHoles: [],
        recommendations: [rec("wr1", "A.J. Brown")],
      }),
    ).toBe("Fade the kicker.");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.anthropic.com/v1/messages");

    expect(
      await getCoachNote({
        draftId: "anth-fail",
        pickNo: 21,
        scoringType: "std",
        isSuperflex: false,
        leagueName: "Std",
        picksUntilUser: 0,
        rosterHoles: ["TE"],
        recommendations: [rec("te1", "Travis Kelce")],
      }),
    ).toBeNull();
  });
});
