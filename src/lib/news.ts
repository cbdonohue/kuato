import { fetchText, loadTtlCache } from "./cache";
import type { DraftStory, PlayerView, Recommendation } from "./types";

export const NEWS_TTL_MS = 30 * 60 * 1000;
export const NEWS_BATCH_MS = 2500;
export const NEWS_STORY_LIMIT = 5;
const PER_PLAYER_FETCH = 3;
const PER_PLAYER_DISPLAY = 2;

export type NewsSource = "ESPN" | "Google News";

export type PlayerHeadline = {
  source: NewsSource;
  headline: string;
  publishedAt: number | null;
  url: string | null;
};

type NewsCache = {
  found: boolean;
  headlines: PlayerHeadline[];
};

const SKIP_NAME_TOKENS = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

export function truncateHeadline(text: string, max = 140): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

export function formatAge(publishedAt: number, now = Date.now()): string {
  const minutes = Math.max(1, Math.round((now - publishedAt) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function titleMatchesPlayer(title: string, name: string): boolean {
  const tokens = name
    .toLowerCase()
    .replace(/['’]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2 && !SKIP_NAME_TOKENS.has(token));
  if (tokens.length === 0) return false;
  const hay = title.toLowerCase().replace(/['’]/g, "");
  return hay.includes(tokens[tokens.length - 1]);
}

function hrefFromUnknown(value: unknown): string | null {
  if (!value || typeof value !== "object") return null;
  const href = (value as { href?: unknown }).href;
  return typeof href === "string" && href.startsWith("http") ? href : null;
}

function espnItemUrl(item: Record<string, unknown>): string | null {
  const links = item.links;
  if (!links || typeof links !== "object") return null;
  const bag = links as Record<string, unknown>;
  return (
    hrefFromUnknown(bag.web) ||
    hrefFromUnknown(bag.mobile) ||
    hrefFromUnknown(bag.api) ||
    null
  );
}

export function parseEspnNews(json: unknown): PlayerHeadline[] {
  if (!json || typeof json !== "object") return [];
  const feed = (json as { feed?: unknown }).feed;
  if (!Array.isArray(feed) || feed.length === 0) return [];
  const items = feed.filter(
    (item): item is Record<string, unknown> =>
      Boolean(item) && typeof item === "object",
  );
  const rotowire = items.filter((item) => item.type === "Rotowire");
  const chosen = (rotowire.length > 0 ? rotowire : items).slice(
    0,
    PER_PLAYER_FETCH,
  );
  const headlines: PlayerHeadline[] = [];
  for (const item of chosen) {
    const headline =
      typeof item.headline === "string" ? item.headline.trim() : "";
    if (!headline) continue;
    const published =
      typeof item.published === "string" ? Date.parse(item.published) : NaN;
    headlines.push({
      source: "ESPN",
      headline,
      publishedAt: Number.isFinite(published) ? published : null,
      url: espnItemUrl(item),
    });
  }
  return headlines;
}

function decodeXml(text: string): string {
  return text
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'");
}

export function parseGoogleRss(
  xml: string,
  playerName: string,
): PlayerHeadline[] {
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  const headlines: PlayerHeadline[] = [];
  let match: RegExpExecArray | null;
  while ((match = itemRe.exec(xml))) {
    const block = match[1];
    const titleMatch = block.match(/<title>([\s\S]*?)<\/title>/i);
    if (!titleMatch) continue;
    const title = decodeXml(titleMatch[1]).replace(/\s+-\s+[^-]+$/, "").trim();
    if (!title || !titleMatchesPlayer(title, playerName)) continue;
    const dateMatch = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/i);
    const published = dateMatch ? Date.parse(decodeXml(dateMatch[1])) : NaN;
    const linkMatch = block.match(/<link>([\s\S]*?)<\/link>/i);
    const url = linkMatch ? decodeXml(linkMatch[1]).trim() : "";
    headlines.push({
      source: "Google News",
      headline: title,
      publishedAt: Number.isFinite(published) ? published : null,
      url: url.startsWith("http") ? url : null,
    });
    if (headlines.length >= PER_PLAYER_FETCH) break;
  }
  return headlines;
}

export function pickTopStories(
  stories: DraftStory[],
  limit = NEWS_STORY_LIMIT,
): DraftStory[] {
  const sorted = [...stories].sort(
    (left, right) => (right.publishedAt ?? 0) - (left.publishedAt ?? 0),
  );
  const perPlayer = new Map<string, number>();
  const seen = new Set<string>();
  const out: DraftStory[] = [];
  for (const story of sorted) {
    const key = story.headline.toLowerCase();
    if (seen.has(key)) continue;
    const count = perPlayer.get(story.playerId) ?? 0;
    if (count >= PER_PLAYER_DISPLAY) continue;
    seen.add(key);
    perPlayer.set(story.playerId, count + 1);
    out.push(story);
    if (out.length >= limit) break;
  }
  return out;
}

function toStory(
  player: PlayerView,
  item: PlayerHeadline,
  now: number,
): DraftStory {
  return {
    playerId: player.playerId,
    playerName: player.name,
    position: player.position,
    source: item.source,
    headline: truncateHeadline(item.headline),
    publishedAt: item.publishedAt,
    age: item.publishedAt == null ? null : formatAge(item.publishedAt, now),
    url: item.url,
  };
}

function cacheName(playerId: string): string {
  return `news-v2-${playerId.replace(/[^a-zA-Z0-9_-]/g, "")}.json`;
}

function isAbortError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  return error instanceof Error && error.name === "AbortError";
}

async function fetchEspnHeadlines(
  espnId: string,
  signal: AbortSignal,
): Promise<PlayerHeadline[]> {
  const url = `https://site.api.espn.com/apis/fantasy/v2/games/ffl/news/players?limit=5&playerId=${encodeURIComponent(espnId)}`;
  try {
    const text = await fetchText(url, { signal });
    return parseEspnNews(JSON.parse(text) as unknown);
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    return [];
  }
}

async function fetchGoogleHeadlines(
  player: PlayerView,
  signal: AbortSignal,
): Promise<PlayerHeadline[]> {
  const query = `"${player.name}" ${player.team} NFL`;
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-US&gl=US&ceid=US:en`;
  try {
    const xml = await fetchText(url, { signal });
    return parseGoogleRss(xml, player.name);
  } catch (error) {
    if (isAbortError(error, signal)) throw error;
    return [];
  }
}

async function loadHeadlines(
  player: PlayerView,
  signal: AbortSignal,
): Promise<PlayerHeadline[]> {
  const packed = await loadTtlCache<NewsCache>(
    cacheName(player.playerId),
    NEWS_TTL_MS,
    async () => {
      if (signal.aborted) throw new Error("aborted");
      const espn = player.espnId
        ? await fetchEspnHeadlines(player.espnId, signal)
        : [];
      if (espn.length > 0) return { found: true, headlines: espn };
      const rss = await fetchGoogleHeadlines(player, signal);
      return { found: rss.length > 0, headlines: rss };
    },
  );
  return packed.headlines ?? [];
}

export async function loadRecStories(
  recs: Recommendation[],
  now = Date.now(),
): Promise<{ stories: DraftStory[]; sources: NewsSource[] }> {
  if (recs.length === 0) return { stories: [], sources: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), NEWS_BATCH_MS);
  try {
    const perPlayer = await Promise.all(
      recs.map(async (rec) => {
        try {
          return await loadHeadlines(rec.player, controller.signal);
        } catch {
          return [] as PlayerHeadline[];
        }
      }),
    );
    const collected: DraftStory[] = [];
    const sources: NewsSource[] = [];
    recs.forEach((rec, index) => {
      for (const item of perPlayer[index]) {
        collected.push(toStory(rec.player, item, now));
        if (!sources.includes(item.source)) sources.push(item.source);
      }
    });
    return { stories: pickTopStories(collected, NEWS_STORY_LIMIT), sources };
  } finally {
    clearTimeout(timer);
  }
}
