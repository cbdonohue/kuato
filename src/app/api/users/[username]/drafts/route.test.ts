import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/session", () => ({
  unauthorizedResponse: vi.fn(),
}));
vi.mock("@/lib/sleeper", () => ({
  getUser: vi.fn(),
  getNflState: vi.fn(),
  getUserDrafts: vi.fn(),
  SleeperNotFoundError: class SleeperNotFoundError extends Error {
    constructor(resource: string) {
      super(`Sleeper ${resource} was not found`);
      this.name = "SleeperNotFoundError";
    }
  },
}));

import { unauthorizedResponse } from "@/lib/session";
import { getNflState, getUser, getUserDrafts, SleeperNotFoundError } from "@/lib/sleeper";
import { GET } from "./route";

describe("GET /api/users/[username]/drafts", () => {
  beforeEach(() => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(null);
    vi.mocked(getUser).mockReset();
    vi.mocked(getNflState).mockReset();
    vi.mocked(getUserDrafts).mockReset();
  });

  it("returns 401 when there is no session", async () => {
    vi.mocked(unauthorizedResponse).mockResolvedValue(
      Response.json({ error: "Unauthorized" }, { status: 401 }),
    );
    const res = await GET(new NextRequest("http://localhost/api/users/brian/drafts"), {
      params: Promise.resolve({ username: "brian" }),
    });
    expect(res.status).toBe(401);
  });

  it("rejects a blank username", async () => {
    const res = await GET(new NextRequest("http://localhost/api/users/%20/drafts"), {
      params: Promise.resolve({ username: "  " }),
    });
    expect(res.status).toBe(400);
  });

  it("returns the user's drafts for the current season", async () => {
    vi.mocked(getUser).mockResolvedValue({
      user_id: "u1",
      username: "brian",
      display_name: "Brian",
      avatar: null,
    });
    vi.mocked(getNflState).mockResolvedValue({ season: "2026" });
    vi.mocked(getUserDrafts).mockResolvedValue([
      {
        draft_id: "d1",
        league_id: "l1",
        type: "snake",
        status: "pre_draft",
        sport: "nfl",
        season: "2026",
        start_time: 1,
        settings: { teams: 12, rounds: 15 },
        metadata: { scoring_type: "ppr", name: "Home League" },
      },
    ]);

    const res = await GET(new NextRequest("http://localhost/api/users/brian/drafts"), {
      params: Promise.resolve({ username: "brian" }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      user: { user_id: "u1", username: "brian", display_name: "Brian", avatar: null },
      season: "2026",
      drafts: [
        {
          draftId: "d1",
          leagueId: "l1",
          name: "Home League",
          status: "pre_draft",
          type: "snake",
          scoringType: "ppr",
          teams: 12,
          rounds: 15,
          startTime: 1,
          season: "2026",
        },
      ],
    });
  });

  it("maps a missing user to 404 and other errors to 502", async () => {
    vi.mocked(getUser).mockRejectedValueOnce(new SleeperNotFoundError("user ghost"));
    const missing = await GET(new NextRequest("http://localhost/api/users/ghost/drafts"), {
      params: Promise.resolve({ username: "ghost" }),
    });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'No Sleeper user named "ghost"' });

    vi.mocked(getUser).mockRejectedValueOnce(new Error("timeout"));
    const failed = await GET(new NextRequest("http://localhost/api/users/brian/drafts"), {
      params: Promise.resolve({ username: "brian" }),
    });
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "timeout" });
  });
});
