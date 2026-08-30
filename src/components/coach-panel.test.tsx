import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CoachPanel } from "./coach-panel";
import type { LiveState, PlayerView } from "@/lib/types";

function player(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId: "te1",
    name: "Travis Kelce",
    position: "TE",
    team: "KC",
    rank: 48,
    sleeperRank: 48,
    adp: 48,
    adpStdev: 4,
    byeWeek: 10,
    age: 36,
    yearsExp: 12,
    rookie: false,
    depth: "TE1",
    lastSeason: null,
    injuryStatus: null,
    injuryNotes: null,
    injuryBodyPart: null,
    practiceParticipation: null,
    espnId: null,
    ...overrides,
  };
}

function liveState(overrides: Partial<LiveState> = {}): LiveState {
  return {
    user: { user_id: "u1", username: "brian", display_name: "Brian", avatar: null },
    draft: {
      draftId: "d1",
      name: "Home League Draft",
      type: "snake",
      status: "drafting",
      season: "2026",
      teams: 12,
      rounds: 15,
      scoringType: "ppr",
      isSuperflex: false,
    },
    leagueName: "Home League",
    unsupported: null,
    clock: {
      pickNo: 25,
      round: 3,
      totalPicks: 180,
      onTheClock: {
        userId: "u2",
        displayName: "Ada",
        slot: 2,
        rosterId: 2,
        isYou: false,
      },
      picksUntilUser: 2,
      nextUserPickNo: 27,
    },
    roster: [{ slot: "TE", player: null }],
    recommendations: [{ player: player(), reasons: ["Fills a starter hole"] }],
    stories: [
      {
        playerId: "te1",
        playerName: "Travis Kelce",
        position: "TE",
        source: "ESPN",
        headline: "Kelce expected to play",
        publishedAt: 1,
        age: "1h ago",
        url: null,
      },
    ],
    newsSources: ["ESPN"],
    coachNote: "Fill TE before the run on them.",
    aiEnabled: true,
    recentPicks: [],
    available: [player()],
    ...overrides,
  };
}

const noop = () => {};

function renderPanel(
  extras: Partial<Parameters<typeof CoachPanel>[0]> = {},
) {
  return render(
    <CoachPanel
      draftId="d1"
      username="brian"
      state={liveState()}
      trigger={null}
      compareMode={false}
      selectedIds={[]}
      selectedNames={[]}
      onToggleCompare={noop}
      onClearCompare={noop}
      onCompareSelected={noop}
      {...extras}
    />,
  );
}

describe("CoachPanel", () => {
  it("explains how to enable AI when no key is configured", () => {
    renderPanel({ state: liveState({ aiEnabled: false, coachNote: null }) });
    expect(screen.getByText(/OPENAI_API_KEY/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Review roster" })).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("runs review, briefing, board, ask, and suggestion chips", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Roster review", note: "Take Kelce now." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    expect(screen.getByText("Fill TE before the run on them.")).toBeInTheDocument();
    expect(screen.getByText("On")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Review roster" }));
    expect(await screen.findByText("Take Kelce now.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/drafts/d1/ai?username=brian",
      expect.objectContaining({ method: "POST" }),
    );

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "News briefing", note: "News is quiet." }),
    });
    await user.click(screen.getByRole("button", { name: "News briefing" }));
    expect(await screen.findByText("News is quiet.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Sleepers & fades", note: "Fade the kicker." }),
    });
    await user.click(screen.getByRole("button", { name: "Sleepers & fades" }));
    expect(await screen.findByText("Fade the kicker.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Ask", note: "Wait one pick." }),
    });
    await user.type(screen.getByPlaceholderText("Ask about this board…"), "Wait on TE?");
    await user.click(screen.getByRole("button", { name: "Ask" }));
    expect(await screen.findByText("Wait one pick.")).toBeInTheDocument();

    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ title: "Ask", note: "Take the TE." }),
    });
    await user.click(screen.getByRole("button", { name: "Should I take a TE now or wait?" }));
    expect(await screen.findByText("Take the TE.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows API and network errors, ignores abort, and skips empty asks", async () => {
    const user = userEvent.setup();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: "Coach is unavailable right now." }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      })
      .mockRejectedValueOnce(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();

    await user.click(screen.getByRole("button", { name: "Review roster" }));
    expect(await screen.findByText("Coach is unavailable right now.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Sleepers & fades" }));
    expect(await screen.findByText("Coach request failed")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "News briefing" }));
    expect(await screen.findByText("Network error talking to the coach")).toBeInTheDocument();

    const form = screen.getByPlaceholderText("Ask about this board…").closest("form");
    expect(form).toBeTruthy();
    fireEvent.submit(form!);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    vi.unstubAllGlobals();
  });

  it("ignores aborted coach requests", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockRejectedValue(new DOMException("Aborted", "AbortError"));
    vi.stubGlobal("fetch", fetchMock);
    renderPanel();
    await user.click(screen.getByRole("button", { name: "Review roster" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    expect(screen.queryByText("Network error talking to the coach")).not.toBeInTheDocument();
    expect(screen.queryByText("Take Kelce now.")).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("runs an external trigger once per nonce and shows compare chrome", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ title: "Scout · Travis Kelce", note: "Scouted." }),
    });
    vi.stubGlobal("fetch", fetchMock);
    const onToggleCompare = vi.fn();
    const onClearCompare = vi.fn();
    const onCompareSelected = vi.fn();
    const { rerender } = renderPanel({
      trigger: { nonce: 1, action: "scout", playerId: "te1" },
    });
    expect(await screen.findByText("Scouted.")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledOnce();

    rerender(
      <CoachPanel
        draftId="d1"
        username="brian"
        state={liveState()}
        trigger={{ nonce: 1, action: "scout", playerId: "te1" }}
        compareMode={false}
        selectedIds={[]}
        selectedNames={[]}
        onToggleCompare={onToggleCompare}
        onClearCompare={onClearCompare}
        onCompareSelected={onCompareSelected}
      />,
    );
    expect(fetchMock).toHaveBeenCalledOnce();

    rerender(
      <CoachPanel
        draftId="d1"
        username="brian"
        state={liveState({ stories: [] })}
        trigger={{ nonce: 2, action: "board" }}
        compareMode
        selectedIds={["te1", "401"]}
        selectedNames={["Travis Kelce", "Ja'Marr Chase"]}
        onToggleCompare={onToggleCompare}
        onClearCompare={onClearCompare}
        onCompareSelected={onCompareSelected}
      />,
    );
    expect(await screen.findByText("Selected: Travis Kelce vs Ja'Marr Chase")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "News briefing" })).toBeDisabled();
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "Compare selected" }));
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(onCompareSelected).toHaveBeenCalledOnce();
    expect(onClearCompare).toHaveBeenCalledOnce();
    expect(onToggleCompare).toHaveBeenCalledOnce();
    vi.unstubAllGlobals();
  });

  it("shows the empty compare prompt until two players are picked", () => {
    const { rerender } = renderPanel({
      compareMode: true,
      selectedIds: [],
      selectedNames: [],
    });
    expect(screen.getByText(/Click two players/)).toBeInTheDocument();
    rerender(
      <CoachPanel
        draftId="d1"
        username="brian"
        state={liveState()}
        trigger={null}
        compareMode
        selectedIds={["te1"]}
        selectedNames={["Travis Kelce"]}
        onToggleCompare={noop}
        onClearCompare={noop}
        onCompareSelected={noop}
      />,
    );
    expect(screen.getByText("Selected: Travis Kelce")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compare selected" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Clear" })).toBeInTheDocument();
  });
});
