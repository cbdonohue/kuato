import { describe, expect, it, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { LiveRoom } from "./live-room";
import type { LiveState, PlayerView } from "@/lib/types";

vi.mock("@/app/login/actions", () => ({
  logout: vi.fn(),
}));

function playerView(overrides: Partial<PlayerView> = {}): PlayerView {
  return {
    playerId: "wr1",
    name: "Ja'Marr Chase",
    position: "WR",
    team: "CIN",
    rank: 2.4,
    sleeperRank: 2,
    adp: 2.4,
    adpStdev: 1,
    byeWeek: 10,
    age: 26,
    yearsExp: 5,
    rookie: false,
    depth: "WR1",
    lastSeason: {
      season: 2025,
      games: 17,
      fantasyPts: 340,
      snapPct: 90,
      line: "127 rec, 1700 yds, 17 TD",
    },
    injuryStatus: null,
    injuryNotes: null,
    injuryBodyPart: null,
    practiceParticipation: null,
    espnId: "4241479",
    ...overrides,
  };
}

function liveState(overrides: Partial<LiveState> = {}): LiveState {
  return {
    user: {
      user_id: "u1",
      username: "brian",
      display_name: "Brian",
      avatar: null,
    },
    draft: {
      draftId: "d1",
      name: "Home League Draft",
      type: "snake",
      status: "drafting",
      season: "2026",
      teams: 12,
      rounds: 15,
      scoringType: "ppr",
      isSuperflex: true,
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
    roster: [
      {
        slot: "QB",
        player: playerView({
          playerId: "qb1",
          name: "Jalen Hurts",
          position: "QB",
          team: "PHI",
          injuryStatus: "Questionable",
        }),
      },
      { slot: "RB", player: null },
    ],
    recommendations: [
      {
        player: playerView(),
        reasons: ["Fills a starter hole"],
      },
      {
        player: playerView({
          playerId: "rb1",
          name: "Derrick Henry",
          position: "RB",
          team: "BAL",
          adp: null,
          sleeperRank: 4,
          lastSeason: null,
          depth: null,
          rookie: false,
          yearsExp: 9,
        }),
        reasons: ["Helps RB / flex depth"],
      },
    ],
    stories: [
      {
        playerId: "wr1",
        playerName: "Ja'Marr Chase",
        position: "WR",
        source: "ESPN",
        headline: "Chase limited Wednesday",
        publishedAt: 1,
        age: "1h ago",
        url: "https://www.espn.com/chase",
      },
      {
        playerId: "rb1",
        playerName: "Derrick Henry",
        position: "RB",
        source: "Google News",
        headline: "Henry expected to play",
        publishedAt: null,
        age: null,
        url: null,
      },
    ],
    newsSources: ["ESPN", "Google News"],
    coachNote: "Take Chase if Henry is gone.",
    aiEnabled: true,
    recentPicks: [
      {
        pickNo: 24,
        round: 2,
        player: playerView({ playerId: "taken", name: "A.J. Brown", position: "WR" }),
        pickedByName: "Ada",
        isYou: false,
      },
      {
        pickNo: 23,
        round: 2,
        player: playerView({ playerId: "mine", name: "Bijan Robinson", position: "RB" }),
        pickedByName: "Brian",
        isYou: true,
      },
    ],
    available: [
      playerView(),
      playerView({
        playerId: "rb1",
        name: "Derrick Henry",
        position: "RB",
        team: "BAL",
        adp: 4,
        byeWeek: null,
        lastSeason: null,
        rookie: true,
        depth: "RB1",
      }),
      playerView({
        playerId: "k1",
        name: "Ka'imi Fairbairn",
        position: "K",
        team: "HOU",
        adp: 136.2,
        lastSeason: null,
        depth: null,
        rookie: false,
        yearsExp: null,
        injuryStatus: "Out",
      }),
    ],
    ...overrides,
  };
}

function mockLive(payload: LiveState | { error: string }, ok = true) {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok,
      json: async () => payload,
    }),
  );
}

describe("LiveRoom", () => {
  it("shows a loading state then the live board", async () => {
    mockLive(liveState());
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(screen.getByText("Loading draft board…")).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Home League Draft" })).toBeInTheDocument();
    expect(screen.getByText(/Superflex/)).toBeInTheDocument();
    expect(screen.getByText("Your pick in 2")).toBeInTheDocument();
    expect(screen.getByText("On the clock: Ada")).toBeInTheDocument();
    expect(screen.getByText("Take Chase if Henry is gone.")).toBeInTheDocument();
    expect(screen.getByText("Chase limited Wednesday")).toBeInTheDocument();
    expect(screen.getByText("Henry expected to play")).toBeInTheDocument();
    expect(screen.getByText("2 stories")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Chase limited Wednesday/ })).toHaveAttribute(
      "href",
      "https://www.espn.com/chase",
    );
    expect(screen.getByText("you")).toBeInTheDocument();
    expect(screen.getByText("Empty")).toBeInTheDocument();
    expect(screen.getByText(/Jalen Hurts/)).toBeInTheDocument();
    expect(screen.getAllByText(/Questionable/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Headlines from/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows an error when the first load fails", async () => {
    mockLive({ error: "Draft missing" }, false);
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("Draft missing")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to lookup" })).toHaveAttribute("href", "/");
    vi.unstubAllGlobals();
  });

  it("shows a network error when fetch throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("Network error")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("labels the clock, unsupported drafts, and empty lists", async () => {
    mockLive(
      liveState({
        draft: {
          draftId: "d1",
          name: "Auction Room",
          type: "auction",
          status: "complete",
          season: "2026",
          teams: 12,
          rounds: 15,
          scoringType: "std",
          isSuperflex: false,
        },
        unsupported: "auction",
        coachNote: null,
        stories: [],
        newsSources: [],
        recommendations: [],
        recentPicks: [],
        clock: {
          pickNo: 180,
          round: 15,
          totalPicks: 180,
          onTheClock: null,
          picksUntilUser: null,
          nextUserPickNo: null,
        },
      }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("Draft complete")).toBeInTheDocument();
    expect(screen.getByText(/Auction drafts are not scored/)).toBeInTheDocument();
    expect(screen.getByText("No recommendations for this draft type.")).toBeInTheDocument();
    expect(screen.getByText("No picks yet.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows dynasty copy and you're on the clock", async () => {
    mockLive(
      liveState({
        unsupported: "dynasty",
        recommendations: [],
        clock: {
          pickNo: 1,
          round: 1,
          totalPicks: 180,
          onTheClock: {
            userId: "u1",
            displayName: "Brian",
            slot: 1,
            rosterId: 1,
            isYou: true,
          },
          picksUntilUser: 0,
          nextUserPickNo: 1,
        },
      }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("You're on the clock")).toBeInTheDocument();
    expect(screen.getByText(/Dynasty leagues are not scored/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("shows you're up next and waiting on draft order", async () => {
    mockLive(
      liveState({
        clock: {
          pickNo: 2,
          round: 1,
          totalPicks: 180,
          onTheClock: {
            userId: "u2",
            displayName: "Ada",
            slot: 2,
            rosterId: 2,
            isYou: false,
          },
          picksUntilUser: 1,
          nextUserPickNo: 3,
        },
      }),
    );
    const { unmount } = render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("You're up next")).toBeInTheDocument();
    unmount();

    mockLive(
      liveState({
        clock: {
          pickNo: 1,
          round: 1,
          totalPicks: 180,
          onTheClock: null,
          picksUntilUser: null,
          nextUserPickNo: null,
        },
        draft: {
          draftId: "d1",
          name: "Home League Draft",
          type: "snake",
          status: "pre_draft",
          season: "2026",
          teams: 12,
          rounds: 15,
          scoringType: "ppr",
          isSuperflex: false,
        },
      }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("Waiting on draft order")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("filters the remaining board by search and position", async () => {
    const user = userEvent.setup();
    mockLive(liveState());
    render(<LiveRoom draftId="d1" username="brian" />);
    const board = () =>
      screen.getByRole("heading", { name: "Remaining board" }).closest("section")
      ?? screen.getByRole("heading", { name: "Remaining board" }).parentElement!
        .parentElement!;
    expect(await screen.findByRole("heading", { name: "Remaining board" })).toBeInTheDocument();
    expect(within(board()).getByText(/Derrick Henry/)).toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "RB");
    expect(within(board()).getByText(/Derrick Henry/)).toBeInTheDocument();
    expect(within(board()).queryByText(/Ka'imi Fairbairn/)).not.toBeInTheDocument();

    await user.selectOptions(screen.getByRole("combobox"), "ALL");
    await user.type(screen.getByPlaceholderText("Search players"), "hou");
    expect(within(board()).getByText(/Ka'imi Fairbairn/)).toBeInTheDocument();
    expect(within(board()).queryByText(/Derrick Henry/)).not.toBeInTheDocument();

    await user.clear(screen.getByPlaceholderText("Search players"));
    await user.type(screen.getByPlaceholderText("Search players"), "zzzz");
    expect(screen.getByText("No matching players.")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("covers ADP, rank, and last-season display variants", async () => {
    mockLive(
      liveState({
        recommendations: [
          {
            player: playerView({
              adp: 25,
              sleeperRank: 80,
              injuryStatus: "Questionable",
              rookie: true,
              yearsExp: 0,
            }),
            reasons: ["Falling vs ADP"],
          },
          {
            player: playerView({
              playerId: "deep",
              name: "Waiver Wire",
              adp: null,
              sleeperRank: 9999,
              byeWeek: null,
              depth: null,
              rookie: false,
              yearsExp: null,
              age: 24,
              lastSeason: {
                season: 2025,
                games: 8,
                fantasyPts: 40,
                snapPct: null,
                line: "",
              },
            }),
            reasons: ["Best available on the board"],
          },
        ],
      }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText(/ADP 25/)).toBeInTheDocument();
    expect(screen.getByText(/Rank —/)).toBeInTheDocument();
    expect(screen.getAllByText(/Rookie/).length).toBeGreaterThan(0);
    vi.unstubAllGlobals();
  });

  it("shows a refresh issue after a later poll fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          json: async () => liveState(),
        })
        .mockResolvedValue({
          ok: false,
          json: async () => ({ error: "upstream" }),
        }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByRole("heading", { name: "Home League Draft" })).toBeInTheDocument();
    expect(
      await screen.findByText("Refresh issue: upstream", {}, { timeout: 4000 }),
    ).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("scouts a player and compares two board selections", async () => {
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockImplementation((url: string, init?: RequestInit) => {
      if (String(url).includes("/ai")) {
        const body = JSON.parse(String(init?.body ?? "{}")) as { action?: string };
        return Promise.resolve({
          ok: true,
          json: async () =>
            body.action === "compare"
              ? { title: "Compare · Chase vs Henry", note: "Take Chase." }
              : { title: "Scout · Ja'Marr Chase", note: "Scouted Chase." },
        });
      }
      return Promise.resolve({
        ok: true,
        json: async () => liveState(),
      });
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByRole("heading", { name: "Home League Draft" })).toBeInTheDocument();

    await user.click(screen.getAllByRole("button", { name: "Scout" })[0]);
    expect(await screen.findByText("Scouted Chase.")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.getByText(/Click two players/)).toBeInTheDocument();
    const selectButtons = screen.getAllByRole("button", { name: "Select" });
    await user.click(selectButtons[0]);
    await user.click(selectButtons[0]);
    await user.click(selectButtons[0]);
    await user.click(selectButtons[1]);
    expect(screen.getByText(/Selected: Ja'Marr Chase vs Derrick Henry/)).toBeInTheDocument();
    await user.click(selectButtons[selectButtons.length - 1]);
    expect(screen.getByText(/Selected: Derrick Henry vs Ka'imi Fairbairn/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Compare selected" }));
    expect(await screen.findByText("Take Chase.")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));
    expect(screen.queryByText(/Selected:/)).not.toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("hides scout when AI is off and labels a single story", async () => {
    mockLive(
      liveState({
        aiEnabled: false,
        coachNote: null,
        stories: [
          {
            playerId: "wr1",
            playerName: "Ja'Marr Chase",
            position: "WR",
            source: "ESPN",
            headline: "Chase limited Wednesday",
            publishedAt: 1,
            age: "1h ago",
            url: "https://www.espn.com/chase",
          },
        ],
        newsSources: ["ESPN"],
        recommendations: [],
        unsupported: null,
      }),
    );
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("1 story")).toBeInTheDocument();
    expect(screen.getByText("No remaining players to recommend.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Scout" })).not.toBeInTheDocument();
    expect(screen.getByText(/OPENAI_API_KEY/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("uses a generic error when the payload has no message", async () => {
    mockLive({} as never, false);
    render(<LiveRoom draftId="d1" username="brian" />);
    expect(await screen.findByText("Failed to load draft")).toBeInTheDocument();
    vi.unstubAllGlobals();
  });
});
