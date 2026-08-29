import type { LiveState, Recommendation, ScoringType } from "./types";

type CoachCacheEntry = {
  note: string;
  at: number;
};

const cache = new Map<string, CoachCacheEntry>();

function cacheKey(draftId: string, pickNo: number, topPlayerId: string): string {
  return `${draftId}:${pickNo}:${topPlayerId}`;
}

export function shouldAskCoach(picksUntilUser: number | null): boolean {
  return picksUntilUser !== null && picksUntilUser <= 2;
}

export function hasLlmKey(): boolean {
  return Boolean(process.env.OPENAI_API_KEY || process.env.ANTHROPIC_API_KEY);
}

export async function getCoachNote(opts: {
  draftId: string;
  pickNo: number;
  scoringType: ScoringType;
  isSuperflex: boolean;
  leagueName: string;
  picksUntilUser: number | null;
  rosterHoles: string[];
  recommendations: Recommendation[];
}): Promise<string | null> {
  if (!hasLlmKey()) return null;
  if (!shouldAskCoach(opts.picksUntilUser)) return null;
  if (opts.recommendations.length === 0) return null;

  const top = opts.recommendations[0];
  const key = cacheKey(opts.draftId, opts.pickNo, top.player.playerId);
  const hit = cache.get(key);
  if (hit) return hit.note;

  const prompt = buildPrompt(opts);
  try {
    const note = process.env.OPENAI_API_KEY
      ? await callOpenAi(prompt)
      : await callAnthropic(prompt);
    if (note) cache.set(key, { note, at: Date.now() });
    return note;
  } catch {
    return null;
  }
}

function buildPrompt(opts: {
  scoringType: ScoringType;
  isSuperflex: boolean;
  leagueName: string;
  picksUntilUser: number | null;
  rosterHoles: string[];
  recommendations: Recommendation[];
}): string {
  const lines = opts.recommendations.slice(0, 5).map((rec, index) => {
    const s = rec.scores;
    const ly = rec.player.lastSeason
      ? ` LY ${rec.player.lastSeason.fantasyPts} pts`
      : "";
    const adp =
      rec.player.adp != null ? ` ADP ${rec.player.adp}` : ` rank ${rec.player.rank}`;
    return `${index + 1}. ${rec.player.name} (${rec.player.position}, ${rec.player.team})${adp}${ly} — value ${s.value}, need ${s.need}, scarcity ${s.scarcity}, window ${s.window}, total ${s.total}. ${rec.reasons.join("; ")}`;
  });
  const when =
    opts.picksUntilUser === 0
      ? "The manager is on the clock."
      : `The manager picks in ${opts.picksUntilUser} selection(s).`;
  return [
    `You are a concise fantasy football draft coach for a redraft league.`,
    `League: ${opts.leagueName}. Scoring: ${opts.scoringType}. Superflex: ${opts.isSuperflex ? "yes" : "no"}.`,
    when,
    `Open starter holes: ${opts.rosterHoles.length ? opts.rosterHoles.join(", ") : "none (bench / depth)"}.`,
    `Ranked recommendations:`,
    ...lines,
    `Write 2-3 sentences. Name who to take and why. Mention one player to fade. No preamble, no markdown.`,
  ].join("\n");
}

async function callOpenAi(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.4,
        max_tokens: 180,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    return data.choices?.[0]?.message?.content?.trim() || null;
  } finally {
    clearTimeout(timer);
  }
}

async function callAnthropic(prompt: string): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-5-haiku-latest",
        max_tokens: 180,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: controller.signal,
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      content?: { type: string; text?: string }[];
    };
    const text = data.content?.find((part) => part.type === "text")?.text;
    return text?.trim() || null;
  } finally {
    clearTimeout(timer);
  }
}

export function rosterHoleLabels(stateRoster: LiveState["roster"]): string[] {
  return stateRoster
    .filter((slot) => !slot.player && slot.slot !== "BN" && slot.slot !== "IR")
    .map((slot) => slot.slot);
}
