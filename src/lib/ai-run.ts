import {
  actionTitle,
  buildAiPrompt,
  EMPTY_INJURY_NOTE,
  findPlayer,
  hasInjuryFlags,
  tokenBudget,
  type AiRequest,
  type AiResult,
} from "./ai";
import { completeLlm, hasLlmKey } from "./llm";
import { buildLiveState } from "./live";

export class AiRequestError extends Error {
  status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "AiRequestError";
    this.status = status;
  }
}

type CacheEntry = { note: string; title: string; at: number };

const cache = new Map<string, CacheEntry>();

function extraKey(request: AiRequest): string {
  if (request.action === "ask") return (request.question ?? "").toLowerCase();
  if (request.action === "scout") return request.playerId ?? "";
  if (request.action === "compare") {
    return [...(request.playerIds ?? [])].sort().join(",");
  }
  return "";
}

export async function runAiAction(
  draftId: string,
  username: string,
  request: AiRequest,
): Promise<AiResult> {
  if (!hasLlmKey()) {
    throw new AiRequestError("AI is not configured on this server.", 503);
  }

  const state = await buildLiveState(draftId, username, { skipCoach: true });
  const title = actionTitle(request, state);

  if (request.action === "scout") {
    const player = request.playerId ? findPlayer(state, request.playerId) : null;
    if (!player) {
      throw new AiRequestError("That player is not on this board.", 404);
    }
  }

  if (request.action === "compare") {
    const ids = request.playerIds ?? [];
    const missing = ids.filter((id) => !findPlayer(state, id));
    if (missing.length) {
      throw new AiRequestError("One of those players is not on this board.", 404);
    }
  }

  if (request.action === "briefing" && state.stories.length === 0) {
    return {
      title,
      note: "No rec headlines are loaded yet. News appears once there are top-5 recommendations.",
    };
  }

  if (request.action === "injury" && !hasInjuryFlags(state)) {
    return {
      title,
      note: EMPTY_INJURY_NOTE,
    };
  }

  const key = `${draftId}:${state.clock.pickNo}:${request.action}:${extraKey(request)}`;
  const hit = cache.get(key);
  if (hit) return { title: hit.title, note: hit.note };

  const prompt = buildAiPrompt(request, state);
  const note = await completeLlm({
    prompt,
    maxTokens: tokenBudget(request.action),
    timeoutMs: 12000,
    temperature: 0.4,
  });
  if (!note) {
    throw new AiRequestError("Coach is unavailable right now.", 502);
  }
  cache.set(key, { title, note, at: Date.now() });
  return { title, note };
}
