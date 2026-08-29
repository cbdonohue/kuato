import { describe, expect, it } from "vitest";
import {
  parseEspnNews,
  parseGoogleRss,
  pickTopStories,
  titleMatchesPlayer,
} from "./news";
import type { DraftStory } from "./types";

const espnFixture = {
  feed: [
    {
      type: "Story",
      headline: "Fantasy football winners and losers after the NFL draft",
      published: "2026-08-01T12:00:00Z",
      links: { web: { href: "https://www.espn.com/story" } },
    },
    {
      type: "Rotowire",
      headline: "Chase limited in practice Wednesday",
      published: "2026-08-29T15:00:00Z",
      links: { mobile: { href: "https://m.espn.go.com/wireless/story?storyId=1" } },
    },
    {
      type: "Rotowire",
      headline: "Chase (hamstring) returned to practice Thursday",
      published: "2026-08-28T15:00:00Z",
    },
  ],
};

const googleRss = `<?xml version="1.0" encoding="UTF-8"?>
<rss>
  <channel>
    <item>
      <title>College basketball scores - ESPN</title>
      <pubDate>Sat, 29 Aug 2026 10:00:00 GMT</pubDate>
      <link>https://news.google.com/skip</link>
    </item>
    <item>
      <title><![CDATA[Ja'Marr Chase limited in Bengals practice - NFL.com]]></title>
      <pubDate>Sat, 29 Aug 2026 14:00:00 GMT</pubDate>
      <link>https://news.google.com/chase-1</link>
    </item>
    <item>
      <title>Ja'Marr Chase expected to play Week 1 - CBS Sports</title>
      <pubDate>Fri, 28 Aug 2026 14:00:00 GMT</pubDate>
      <link>https://news.google.com/chase-2</link>
    </item>
  </channel>
</rss>`;

function story(
  overrides: Partial<DraftStory> & Pick<DraftStory, "playerId" | "headline">,
): DraftStory {
  return {
    playerName: overrides.playerName ?? overrides.playerId,
    position: "WR",
    source: "ESPN",
    publishedAt: null,
    age: null,
    url: null,
    ...overrides,
  };
}

describe("parseEspnNews", () => {
  it("returns Rotowire items with published time and url", () => {
    const items = parseEspnNews(espnFixture);
    expect(items).toHaveLength(2);
    expect(items[0].headline).toBe("Chase limited in practice Wednesday");
    expect(items[0].publishedAt).toBe(Date.parse("2026-08-29T15:00:00Z"));
    expect(items[0].url).toBe("https://m.espn.go.com/wireless/story?storyId=1");
    expect(items[1].headline).toBe("Chase (hamstring) returned to practice Thursday");
  });

  it("returns an empty list for empty feeds", () => {
    expect(parseEspnNews({ feed: [] })).toEqual([]);
    expect(parseEspnNews(null)).toEqual([]);
  });
});

describe("parseGoogleRss", () => {
  it("returns matching items and skips unrelated titles", () => {
    const items = parseGoogleRss(googleRss, "Ja'Marr Chase");
    expect(items.map((item) => item.headline)).toEqual([
      "Ja'Marr Chase limited in Bengals practice",
      "Ja'Marr Chase expected to play Week 1",
    ]);
    expect(items[0].url).toBe("https://news.google.com/chase-1");
  });

  it("ignores a title that does not contain the player name", () => {
    expect(titleMatchesPlayer("College basketball scores", "Ja'Marr Chase")).toBe(
      false,
    );
    expect(parseGoogleRss(googleRss, "Bijan Robinson")).toEqual([]);
  });
});

describe("pickTopStories", () => {
  it("keeps the newest stories and caps two per player", () => {
    const picked = pickTopStories(
      [
        story({
          playerId: "a",
          headline: "Old A",
          publishedAt: 1,
        }),
        story({
          playerId: "a",
          headline: "New A",
          publishedAt: 30,
        }),
        story({
          playerId: "a",
          headline: "Newer A",
          publishedAt: 40,
        }),
        story({
          playerId: "b",
          headline: "New B",
          publishedAt: 20,
        }),
        story({
          playerId: "c",
          headline: "New C",
          publishedAt: 10,
        }),
      ],
      4,
    );
    expect(picked.map((item) => item.headline)).toEqual([
      "Newer A",
      "New A",
      "New B",
      "New C",
    ]);
  });
});
