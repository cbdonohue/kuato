import { rosterHoleLabels } from "./coach";
import type { LiveState, PlayerView } from "./types";

export const AI_ACTIONS = [
  "ask",
  "scout",
  "compare",
  "review",
  "briefing",
  "board",
] as const;

export type AiAction = (typeof AI_ACTIONS)[number];

export type AiRequest = {
  action: AiAction;
  question?: string;
  playerId?: string;
  playerIds?: string[];
};

export type AiResult = {
  title: string;
  note: string;
};

const ACTION_SET = new Set<string>(AI_ACTIONS);
const MAX_QUESTION = 400;

export function parseAiRequest(
  body: unknown,
): { ok: true; value: AiRequest } | { ok: false; error: string } {
  if (!body || typeof body !== "object") {
    return { ok: false, error: "JSON body is required" };
  }
  const rec = body as Record<string, unknown>;
  const action = rec.action;
  if (typeof action !== "string" || !ACTION_SET.has(action)) {
    return {
      ok: false,
      error: "action must be ask, scout, compare, review, briefing, or board",
    };
  }
  const question =
    typeof rec.question === "string" ? rec.question.replace(/\s+/g, " ").trim() : "";
  const playerId = typeof rec.playerId === "string" ? rec.playerId.trim() : "";
  const playerIds = Array.isArray(rec.playerIds)
    ? rec.playerIds
        .filter((id): id is string => typeof id === "string")
        .map((id) => id.trim())
        .filter(Boolean)
    : [];

  if (action === "ask") {
    if (!question) return { ok: false, error: "question is required" };
    if (question.length > MAX_QUESTION) {
      return { ok: false, error: "question must be 400 characters or fewer" };
    }
    return { ok: true, value: { action, question } };
  }
  if (action === "scout") {
    if (!playerId) return { ok: false, error: "playerId is required" };
    return { ok: true, value: { action, playerId } };
  }
  if (action === "compare") {
    const ids = playerIds.length >= 2 ? playerIds.slice(0, 2) : [];
    if (ids.length !== 2) return { ok: false, error: "compare needs two playerIds" };
    if (ids[0] === ids[1]) {
      return { ok: false, error: "compare needs two different players" };
    }
    return { ok: true, value: { action, playerIds: ids } };
  }
  return { ok: true, value: { action: action as AiAction } };
}

export function suggestedQuestions(state: LiveState): string[] {
  const holes = new Set(rosterHoleLabels(state.roster));
  const questions: string[] = [];
  if (holes.has("TE")) questions.push("Should I take a TE now or wait?");
  if (holes.has("RB") && holes.has("WR")) {
    questions.push("Do I need RB or WR more here?");
  } else if (holes.has("RB")) {
    questions.push("Is it time to lock in an RB?");
  } else if (holes.has("WR")) {
    questions.push("Should I keep stacking WRs?");
  }
  if (state.stories.length > 0) {
    questions.push("Does any news change this pick?");
  }
  if (holes.has("QB") || state.draft.isSuperflex) {
    questions.push("When should I take a QB?");
  }
  questions.push("Who is the steal if I wait one more pick?");
  questions.push("What's the biggest risk on my roster?");
  return [...new Set(questions)].slice(0, 4);
}

export function formatPlayerLine(player: PlayerView): string {
  const adp = player.adp != null ? `ADP ${player.adp}` : `rank ${player.rank}`;
  const ly = player.lastSeason
    ? ` LY ${player.lastSeason.fantasyPts} pts/${player.lastSeason.games}g`
    : "";
  const bye = player.byeWeek != null ? ` bye ${player.byeWeek}` : "";
  const inj = player.injuryStatus ? ` ${player.injuryStatus}` : "";
  const depth = player.depth ? ` ${player.depth}` : "";
  const rookie = player.rookie ? " rookie" : "";
  return `${player.name} (${player.position} ${player.team}) ${adp}${ly}${bye}${inj}${depth}${rookie}`;
}

export function byeClusters(roster: LiveState["roster"]): string[] {
  const groups = new Map<number, string[]>();
  for (const slot of roster) {
    const player = slot.player;
    if (!player?.byeWeek) continue;
    const list = groups.get(player.byeWeek) ?? [];
    list.push(player.name);
    groups.set(player.byeWeek, list);
  }
  return [...groups.entries()]
    .filter(([, names]) => names.length >= 2)
    .sort((a, b) => a[0] - b[0])
    .map(([week, names]) => `week ${week}: ${names.join(", ")}`);
}

export function findPlayer(state: LiveState, playerId: string): PlayerView | null {
  for (const rec of state.recommendations) {
    if (rec.player.playerId === playerId) return rec.player;
  }
  for (const player of state.available) {
    if (player.playerId === playerId) return player;
  }
  for (const slot of state.roster) {
    if (slot.player?.playerId === playerId) return slot.player;
  }
  for (const pick of state.recentPicks) {
    if (pick.player.playerId === playerId) return pick.player;
  }
  return null;
}

export function draftContext(state: LiveState, boardLimit = 20): string {
  const holes = rosterHoleLabels(state.roster);
  const when =
    state.clock.picksUntilUser === 0
      ? "The manager is on the clock."
      : state.clock.picksUntilUser != null
        ? `The manager picks in ${state.clock.picksUntilUser} selection(s).`
        : "Pick timing is unknown.";
  const rosterLines = state.roster.map((entry) =>
    entry.player
      ? `${entry.slot}: ${formatPlayerLine(entry.player)}`
      : `${entry.slot}: empty`,
  );
  const recLines = state.recommendations.map(
    (rec, index) =>
      `${index + 1}. ${formatPlayerLine(rec.player)}. ${rec.reasons.join("; ")}`,
  );
  const recent = state.recentPicks
    .slice(0, 8)
    .map(
      (pick) =>
        `${pick.pickNo} ${formatPlayerLine(pick.player)} (${pick.isYou ? "you" : pick.pickedByName})`,
    );
  const board = state.available
    .slice(0, boardLimit)
    .map((player) => formatPlayerLine(player));
  const news = state.stories
    .slice(0, 6)
    .map((story) => `${story.playerName}: ${story.headline}`);
  const byes = byeClusters(state.roster);

  return [
    `League: ${state.leagueName}. Scoring: ${state.draft.scoringType}. Superflex: ${state.draft.isSuperflex ? "yes" : "no"}. ${state.draft.teams} teams, ${state.draft.rounds} rounds.`,
    `Pick ${state.clock.pickNo} of ${state.clock.totalPicks}, round ${state.clock.round}. ${when}`,
    `Open starter holes: ${holes.length ? holes.join(", ") : "none (bench / depth)"}.`,
    byes.length ? `Bye clusters: ${byes.join(" | ")}` : "",
    "Roster:",
    ...rosterLines,
    recLines.length ? "Ranked recommendations:" : "",
    ...recLines,
    recent.length ? "Recent picks:" : "",
    ...recent,
    board.length ? "Best remaining (ADP):" : "",
    ...board,
    news.length ? "News:" : "",
    ...news,
  ]
    .filter((line) => line.length > 0)
    .join("\n");
}

export function actionTitle(request: AiRequest, state: LiveState): string {
  if (request.action === "ask") return "Ask";
  if (request.action === "review") return "Roster review";
  if (request.action === "briefing") return "News briefing";
  if (request.action === "board") return "Sleepers & fades";
  if (request.action === "scout") {
    const player = request.playerId ? findPlayer(state, request.playerId) : null;
    return player ? `Scout · ${player.name}` : "Scout";
  }
  if (request.action === "compare") {
    const names = (request.playerIds ?? [])
      .map((id) => findPlayer(state, id)?.name)
      .filter(Boolean);
    return names.length === 2 ? `Compare · ${names[0]} vs ${names[1]}` : "Compare";
  }
  return "Coach";
}

export function buildAiPrompt(request: AiRequest, state: LiveState): string {
  const header =
    "You are a concise fantasy football draft coach for a redraft league. Use only the draft context. No preamble, no markdown, no bullet lists unless asked.";
  const context = draftContext(
    state,
    request.action === "board" ? 40 : 20,
  );

  if (request.action === "ask") {
    return [
      header,
      context,
      `Manager question: ${request.question}`,
      "Answer in 2-4 sentences. If the question is off-topic, say so and point back to the board.",
    ].join("\n\n");
  }

  if (request.action === "scout") {
    const player = request.playerId ? findPlayer(state, request.playerId) : null;
    return [
      header,
      context,
      `Scout this remaining or rostered player: ${player ? formatPlayerLine(player) : request.playerId}.`,
      "Write 2-3 sentences: roster fit, risk (injury, role, bye), and whether to take now or wait.",
    ].join("\n\n");
  }

  if (request.action === "compare") {
    const a = request.playerIds?.[0]
      ? findPlayer(state, request.playerIds[0])
      : null;
    const b = request.playerIds?.[1]
      ? findPlayer(state, request.playerIds[1])
      : null;
    return [
      header,
      context,
      `Compare for this roster: ${a ? formatPlayerLine(a) : request.playerIds?.[0]} vs ${b ? formatPlayerLine(b) : request.playerIds?.[1]}.`,
      "Pick one for the next pick and say who can wait. 3 sentences.",
    ].join("\n\n");
  }

  if (request.action === "review") {
    return [
      header,
      context,
      "Review roster construction in 3-4 sentences. Call out holes, bye clusters, and the plan for the next pick.",
    ].join("\n\n");
  }

  if (request.action === "briefing") {
    return [
      header,
      context,
      "Using the headlines, say what matters for the next pick in 2-3 sentences. Ignore noise that does not change the board.",
    ].join("\n\n");
  }

  return [
    header,
    context,
    "Name 2-3 sleepers still on the board and 2-3 fades. One sentence each. Use ADP, last-season production, and this roster's need.",
  ].join("\n\n");
}

export function tokenBudget(action: AiAction): number {
  if (action === "review" || action === "board") return 260;
  if (action === "ask" || action === "compare") return 220;
  return 180;
}
