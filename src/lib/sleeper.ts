import { mkdir, readFile, writeFile } from "fs/promises";
import path from "path";
import type {
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperNflState,
  SleeperPick,
  SleeperPlayer,
  SleeperRoster,
  SleeperTradedPick,
  SleeperUser,
} from "./types";

const BASE = "https://api.sleeper.app/v1";
const DAY_MS = 24 * 60 * 60 * 1000;
const CACHE_DIR = path.join(process.cwd(), ".cache");
const PLAYERS_CACHE = path.join(CACHE_DIR, "players-nfl.json");

export class SleeperNotFoundError extends Error {
  constructor(resource: string) {
    super(`Sleeper ${resource} was not found`);
    this.name = "SleeperNotFoundError";
  }
}

type PlayerCacheFile = {
  fetchedAt: number;
  players: Record<string, SleeperPlayer>;
};

let playerMemory: PlayerCacheFile | null = null;

async function sleeperGet<T>(pathName: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${pathName}`, {
    cache: "no-store",
    ...init,
  });
  if (res.status === 404) {
    throw new SleeperNotFoundError(pathName);
  }
  if (!res.ok) {
    throw new Error(`Sleeper ${pathName} failed (${res.status})`);
  }
  return (await res.json()) as T;
}

export async function getUser(usernameOrId: string): Promise<SleeperUser> {
  const user = await sleeperGet<SleeperUser>(
    `/user/${encodeURIComponent(usernameOrId)}`,
  );
  if (!user?.user_id) {
    throw new SleeperNotFoundError(`user ${usernameOrId}`);
  }
  return user;
}

export async function getNflState(): Promise<SleeperNflState> {
  return sleeperGet<SleeperNflState>("/state/nfl");
}

export async function getUserDrafts(
  userId: string,
  season: string,
): Promise<SleeperDraft[]> {
  const drafts = await sleeperGet<SleeperDraft[]>(
    `/user/${userId}/drafts/nfl/${season}`,
  );
  return Array.isArray(drafts) ? drafts : [];
}

export async function getDraft(draftId: string): Promise<SleeperDraft> {
  return sleeperGet<SleeperDraft>(`/draft/${draftId}`);
}

export async function getDraftPicks(draftId: string): Promise<SleeperPick[]> {
  const picks = await sleeperGet<SleeperPick[]>(`/draft/${draftId}/picks`);
  return Array.isArray(picks) ? picks : [];
}

export async function getTradedPicks(
  draftId: string,
): Promise<SleeperTradedPick[]> {
  const picks = await sleeperGet<SleeperTradedPick[]>(
    `/draft/${draftId}/traded_picks`,
  );
  return Array.isArray(picks) ? picks : [];
}

export async function getLeague(leagueId: string): Promise<SleeperLeague> {
  return sleeperGet<SleeperLeague>(`/league/${leagueId}`);
}

export async function getLeagueUsers(
  leagueId: string,
): Promise<SleeperLeagueUser[]> {
  const users = await sleeperGet<SleeperLeagueUser[]>(
    `/league/${leagueId}/users`,
  );
  return Array.isArray(users) ? users : [];
}

export async function getLeagueRosters(
  leagueId: string,
): Promise<SleeperRoster[]> {
  const rosters = await sleeperGet<SleeperRoster[]>(
    `/league/${leagueId}/rosters`,
  );
  return Array.isArray(rosters) ? rosters : [];
}

export async function getNflPlayers(): Promise<Record<string, SleeperPlayer>> {
  const now = Date.now();
  if (playerMemory && now - playerMemory.fetchedAt < DAY_MS) {
    return playerMemory.players;
  }

  try {
    const raw = await readFile(PLAYERS_CACHE, "utf8");
    const parsed = JSON.parse(raw) as PlayerCacheFile;
    if (parsed?.players && now - parsed.fetchedAt < DAY_MS) {
      playerMemory = parsed;
      return parsed.players;
    }
  } catch {
    // cold cache
  }

  const players = await sleeperGet<Record<string, SleeperPlayer>>(
    "/players/nfl?active=true",
  );
  playerMemory = { fetchedAt: now, players };

  try {
    await mkdir(CACHE_DIR, { recursive: true });
    await writeFile(PLAYERS_CACHE, JSON.stringify(playerMemory));
  } catch {
    // cache write is best-effort
  }

  return players;
}
