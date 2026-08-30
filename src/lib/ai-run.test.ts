import { beforeEach, describe, expect, it, vi } from "vitest";
import type { LiveState, PlayerView } from "./types";
import { AiRequestError } from "./ai-run";

vi.mock("./live", () => ({
  buildLiveState: vi.fn(),
}));
vi.mock("./llm", () => ({
  completeLlm: vi.fn(),
  hasLlmKey: vi.fn(),
}));

import { buildLiveState } from "./live";
import { completeLlm, hasLlmKey } from "./llm";
import { runAiAction } from "./ai-run";

function player(id: string, extras: Partial<PlayerView> = {}): PlayerView {
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
    lastSeason: extras.lastSeason ?? null,
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
    roster: [{ slot: "WR", player: chase }],
    recommendations: [{ player: kelce, reasons: ["Fills a starter hole"] }],
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
    recentPicks: [],
    available: [kelce, chase],
    ...overrides,
  };
}

describe("AiRequestError", () => {
  it("defaults to a 400 status", () => {
    const error = new AiRequestError("bad request");
    expect(error.name).toBe("AiRequestError");
    expect(error.status).toBe(400);
    expect(error.message).toBe("bad request");
  });
});

describe("runAiAction", () => {
  beforeEach(() => {
    vi.mocked(hasLlmKey).mockReturnValue(true);
    vi.mocked(completeLlm).mockReset();
    vi.mocked(buildLiveState).mockReset();
    vi.mocked(buildLiveState).mockResolvedValue(sampleState());
    vi.mocked(completeLlm).mockResolvedValue("Take the tight end.");
  });

  it("rejects when no LLM key is configured", async () => {
    vi.mocked(hasLlmKey).mockReturnValue(false);
    await expect(runAiAction("d1", "brian", { action: "review" })).rejects.toMatchObject({
      name: "AiRequestError",
      status: 503,
      message: "AI is not configured on this server.",
    });
    expect(buildLiveState).not.toHaveBeenCalled();
  });

  it("rejects scout and compare when players are off the board", async () => {
    await expect(
      runAiAction("missing-scout", "brian", { action: "scout" }),
    ).rejects.toMatchObject({
      status: 404,
      message: "That player is not on this board.",
    });
    await expect(
      runAiAction("missing-scout-id", "brian", { action: "scout", playerId: "nope" }),
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      runAiAction("missing-compare", "brian", {
        action: "compare",
        playerIds: ["te1", "ghost"],
      }),
    ).rejects.toMatchObject({
      status: 404,
      message: "One of those players is not on this board.",
    });
  });

  it("returns a briefing stub when no headlines are loaded", async () => {
    vi.mocked(buildLiveState).mockResolvedValue(sampleState({ stories: [] }));
    await expect(
      runAiAction("brief-empty", "brian", { action: "briefing" }),
    ).resolves.toEqual({
      title: "News briefing",
      note: "No rec headlines are loaded yet. News appears once there are top-5 recommendations.",
    });
    expect(completeLlm).not.toHaveBeenCalled();
  });

  it("asks the model, caches by pick and extra key, and treats empty notes as 502", async () => {
    vi.mocked(completeLlm)
      .mockResolvedValueOnce("Wait a pick on TE.")
      .mockResolvedValueOnce(null);

    const first = await runAiAction("ask-cache", "brian", {
      action: "ask",
      question: "Wait on TE?",
    });
    const cached = await runAiAction("ask-cache", "brian", {
      action: "ask",
      question: "WAIT ON TE?",
    });
    expect(first).toEqual({ title: "Ask", note: "Wait a pick on TE." });
    expect(cached).toEqual(first);
    expect(completeLlm).toHaveBeenCalledOnce();
    expect(buildLiveState).toHaveBeenCalledWith("ask-cache", "brian", { skipCoach: true });

    await expect(
      runAiAction("ask-fail", "brian", { action: "review" }),
    ).rejects.toMatchObject({
      status: 502,
      message: "Coach is unavailable right now.",
    });
  });

  it("scouts, compares in either order, and reviews the roster", async () => {
    vi.mocked(completeLlm)
      .mockResolvedValueOnce("Kelce fits the hole.")
      .mockResolvedValueOnce("Take Kelce, Chase can wait.")
      .mockResolvedValueOnce("Fill TE next.");

    await expect(
      runAiAction("scout-ok", "brian", { action: "scout", playerId: "te1" }),
    ).resolves.toEqual({
      title: "Scout · Travis Kelce",
      note: "Kelce fits the hole.",
    });

    const compare = await runAiAction("cmp", "brian", {
      action: "compare",
      playerIds: ["te1", "401"],
    });
    const swapped = await runAiAction("cmp", "brian", {
      action: "compare",
      playerIds: ["401", "te1"],
    });
    expect(compare.note).toBe("Take Kelce, Chase can wait.");
    expect(swapped).toEqual(compare);

    await expect(runAiAction("rev", "brian", { action: "review" })).resolves.toEqual({
      title: "Roster review",
      note: "Fill TE next.",
    });

    const prompt = vi.mocked(completeLlm).mock.calls[0][0].prompt;
    expect(prompt).toContain("Travis Kelce");
  });

  it("covers empty extra keys for compare and ask", async () => {
    vi.mocked(completeLlm).mockResolvedValue("ok");
    await expect(
      runAiAction("empty-ask", "brian", { action: "ask" }),
    ).resolves.toMatchObject({ title: "Ask", note: "ok" });
    await expect(
      runAiAction("empty-cmp", "brian", { action: "compare" }),
    ).resolves.toMatchObject({ title: "Compare", note: "ok" });
    await expect(
      runAiAction("board", "brian", { action: "board" }),
    ).resolves.toMatchObject({ title: "Sleepers & fades", note: "ok" });
  });

  it("returns an injury stub when nobody is flagged and asks the model when they are", async () => {
    await expect(
      runAiAction("inj-empty", "brian", { action: "injury" }),
    ).resolves.toEqual({
      title: "Injury analysis",
      note: "Nobody on your roster or the remaining ADP board has an injury flag. If a name is dinged up, Sleeper has not marked them yet.",
    });
    expect(completeLlm).not.toHaveBeenCalled();

    vi.mocked(completeLlm).mockResolvedValue("Fade CMC until he is practicing.");
    vi.mocked(buildLiveState).mockResolvedValue(
      sampleState({
        available: [
          player("rb2", {
            name: "Christian McCaffrey",
            position: "RB",
            injuryStatus: "IR",
            injuryBodyPart: "Achilles",
          }),
        ],
      }),
    );
    await expect(
      runAiAction("inj-ok", "brian", { action: "injury" }),
    ).resolves.toEqual({
      title: "Injury analysis",
      note: "Fade CMC until he is practicing.",
    });
    expect(completeLlm).toHaveBeenCalledOnce();
    expect(vi.mocked(completeLlm).mock.calls[0][0].prompt).toContain("Christian McCaffrey");
  });
});
