import { buildLiveState } from "@/lib/live";
import { SleeperNotFoundError } from "@/lib/sleeper";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ draftId: string }> },
) {
  const { draftId } = await params;
  const username = request.nextUrl.searchParams.get("username")?.trim();
  if (!username) {
    return Response.json({ error: "username query is required" }, { status: 400 });
  }

  try {
    const state = await buildLiveState(draftId, username);
    return Response.json(state);
  } catch (error) {
    if (error instanceof SleeperNotFoundError) {
      return Response.json({ error: error.message }, { status: 404 });
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load draft" },
      { status: 502 },
    );
  }
}
