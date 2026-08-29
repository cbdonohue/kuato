import { getNflState, getUser, getUserDrafts, SleeperNotFoundError } from "@/lib/sleeper";
import { scoringFromSettings } from "@/lib/recommend";
import type { DraftListItem } from "@/lib/types";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  if (!username?.trim()) {
    return Response.json({ error: "Username is required" }, { status: 400 });
  }

  try {
    const user = await getUser(username.trim());
    const state = await getNflState();
    const season = state.season;
    const drafts = await getUserDrafts(user.user_id, season);
    const items: DraftListItem[] = drafts.map((draft) => ({
      draftId: draft.draft_id,
      leagueId: draft.league_id,
      name: draft.metadata?.name || `Draft ${draft.draft_id}`,
      status: draft.status,
      type: draft.type,
      scoringType: scoringFromSettings(draft.metadata?.scoring_type),
      teams: draft.settings.teams,
      rounds: draft.settings.rounds,
      startTime: draft.start_time,
      season: draft.season,
    }));

    return Response.json({ user, season, drafts: items });
  } catch (error) {
    if (error instanceof SleeperNotFoundError) {
      return Response.json(
        { error: `No Sleeper user named "${username}"` },
        { status: 404 },
      );
    }
    return Response.json(
      { error: error instanceof Error ? error.message : "Failed to load drafts" },
      { status: 502 },
    );
  }
}
