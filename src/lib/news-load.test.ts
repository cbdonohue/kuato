import { afterEach, describe, expect, it, vi } from "vitest";
import type { PlayerView, Recommendation } from "./types";

vi.mock("./cache", () => ({
  fetchText: vi.fn(),
  loadTtlCache: vi.fn(async (_name: string, _ttl: number, loader: () => Promise<unknown>) =>
    loader(),
  ),
}));

import { fetchText, loadTtlCache } from "./cache";
import { loadRecStories } from "./news";

function rec(overrides: Partial<PlayerView> = {}): Recommendation {
  return {
    player: {
      playerId: "4241",
      name: "Ja'Marr Chase",
      position: "WR",
      team: "CIN",
      rank: 2,
      sleeperRank: 2,
      adp: 2,
      adpStdev: 1,
      byeWeek: 10,
      age: 26,
      yearsExp: 5,
      rookie: false,
      depth: "WR1",
      lastSeason: null,
      injuryStatus: null,
      injuryNotes: null,
      injuryBodyPart: null,
      practiceParticipation: null,
      espnId: "4241479",
      ...overrides,
    },
    reasons: ["Fills a starter hole"],
  };
}

afterEach(() => {
  vi.mocked(fetchText).mockReset();
  vi.mocked(loadTtlCache).mockImplementation(
    async (_name: string, _ttl: number, loader: () => Promise<unknown>) => loader(),
  );
});

describe("loadRecStories", () => {
  it("returns empty collections when there are no recs", async () => {
    await expect(loadRecStories([])).resolves.toEqual({ stories: [], sources: [] });
  });

  it("uses ESPN headlines when the player has an espn id", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce(
      JSON.stringify({
        feed: [
          {
            type: "Rotowire",
            headline: "Chase limited in practice Wednesday",
            published: "2026-08-29T15:00:00Z",
            links: { web: { href: "https://www.espn.com/chase" } },
          },
        ],
      }),
    );

    const result = await loadRecStories([rec()], Date.parse("2026-08-30T12:00:00Z"));
    expect(result.sources).toEqual(["ESPN"]);
    expect(result.stories[0]).toMatchObject({
      playerId: "4241",
      playerName: "Ja'Marr Chase",
      source: "ESPN",
      headline: "Chase limited in practice Wednesday",
      url: "https://www.espn.com/chase",
      age: "21h ago",
    });
    expect(String(vi.mocked(fetchText).mock.calls[0][0])).toContain("playerId=4241479");
  });

  it("falls back to Google News when ESPN is empty", async () => {
    vi.mocked(fetchText)
      .mockResolvedValueOnce(JSON.stringify({ feed: [] }))
      .mockResolvedValueOnce(`<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Ja'Marr Chase expected to play Week 1 - NFL.com</title>
    <pubDate>Sat, 29 Aug 2026 14:00:00 GMT</pubDate>
    <link>https://news.google.com/chase</link>
  </item>
</channel></rss>`);

    const result = await loadRecStories([rec()]);
    expect(result.sources).toEqual(["Google News"]);
    expect(result.stories[0].headline).toBe("Ja'Marr Chase expected to play Week 1");
    expect(result.stories[0].source).toBe("Google News");
  });

  it("skips ESPN and goes to Google when there is no espn id", async () => {
    vi.mocked(fetchText).mockResolvedValueOnce(`<?xml version="1.0"?>
<rss><channel>
  <item>
    <title>Derrick Henry scores twice - ESPN</title>
    <link>https://news.google.com/henry</link>
  </item>
</channel></rss>`);

    const result = await loadRecStories([
      rec({ playerId: "3198", name: "Derrick Henry", team: "BAL", espnId: null }),
    ]);
    expect(result.stories[0].headline).toBe("Derrick Henry scores twice");
    expect(result.stories[0].publishedAt).toBeNull();
    expect(fetchText).toHaveBeenCalledOnce();
  });

  it("swallows per-player fetch failures", async () => {
    vi.mocked(fetchText).mockRejectedValue(new Error("offline"));
    await expect(loadRecStories([rec()])).resolves.toEqual({ stories: [], sources: [] });
  });

  it("returns no headlines when the cache loader is aborted", async () => {
    vi.mocked(loadTtlCache).mockImplementation(async () => {
      throw new DOMException("aborted", "AbortError");
    });
    await expect(loadRecStories([rec()])).resolves.toEqual({ stories: [], sources: [] });
  });
});
