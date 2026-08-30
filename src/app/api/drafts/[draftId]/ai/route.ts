import { parseAiRequest } from "@/lib/ai";
import { AiRequestError, runAiAction } from "@/lib/ai-run";
import { hasLlmKey } from "@/lib/llm";
import { unauthorizedResponse } from "@/lib/session";
import { SleeperNotFoundError } from "@/lib/sleeper";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const denied = await unauthorizedResponse();
  if (denied) return denied;

  if (!hasLlmKey()) {
    return Response.json(
      { error: "AI is not configured on this server." },
      { status: 503 },
    );
  }

  const { draftId } = await params;
  const username = request.nextUrl.searchParams.get("username")?.trim();
  if (!username) {
    return Response.json({ error: "username query is required" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "JSON body is required" }, { status: 400 });
  }

  const parsed = parseAiRequest(body);
  if (!parsed.ok) {
    return Response.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const result = await runAiAction(draftId, username, parsed.value);
    return Response.json(result);
  } catch (error) {
    if (error instanceof AiRequestError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof SleeperNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Coach request failed" },
      { status: 502 },
    );
  }
}
