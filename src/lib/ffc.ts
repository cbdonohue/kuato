import { fetchText, loadDayCache } from "./cache";
import type { ScoringType } from "./types";

export type FfcAdpPlayer = {
  player_id: number;
  name: string;
  position: string;
  team: string;
  adp: number;
  stdev?: number;
  bye?: number;
};

export type FfcMatch = {
  adp: number;
  adpStdev: number | null;
  byeWeek: number | null;
};

export type FfcIndex = {
  byNamePosTeam: Map<string, FfcMatch>;
  byNamePos: Map<string, FfcMatch | "ambiguous">;
  byDefTeam: Map<string, FfcMatch>;
};

const FFC_TEAMS = [8, 10, 12, 14] as const;

export function ffcFormat(scoringType: ScoringType, superflex: boolean): string {
  if (superflex) return "2qb";
  if (scoringType === "ppr") return "ppr";
  if (scoringType === "half_ppr") return "half-ppr";
  return "standard";
}

export function nearestFfcTeams(teams: number): (typeof FFC_TEAMS)[number] {
  return FFC_TEAMS.reduce((best, option) =>
    Math.abs(option - teams) < Math.abs(best - teams) ? option : best,
  );
}

export function canonTeam(team: string): string {
  const upper = team.trim().toUpperCase();
  const map: Record<string, string> = {
    JAC: "JAX",
    JAX: "JAX",
    WSH: "WAS",
    WAS: "WAS",
    LA: "LAR",
    STL: "LAR",
    LAR: "LAR",
    SD: "LAC",
    LAC: "LAC",
    OAK: "LV",
    LVR: "LV",
    LV: "LV",
  };
  return map[upper] ?? upper;
}

export function canonPosition(position: string): string {
  const upper = position.trim().toUpperCase();
  if (upper === "PK" || upper === "K") return "K";
  if (upper === "DST" || upper === "DEF") return "DEF";
  return upper;
}

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/['’.`]/g, "")
    .replace(/\b(jr|sr|iii|ii|iv)\b/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toMatch(player: FfcAdpPlayer): FfcMatch {
  return {
    adp: player.adp,
    adpStdev: player.stdev ?? null,
    byeWeek: player.bye ?? null,
  };
}

export function indexFfcPlayers(players: FfcAdpPlayer[]): FfcIndex {
  const byNamePosTeam = new Map<string, FfcMatch>();
  const byNamePos = new Map<string, FfcMatch | "ambiguous">();
  const byDefTeam = new Map<string, FfcMatch>();

  for (const player of players) {
    const match = toMatch(player);
    const name = normalizeName(player.name);
    const position = canonPosition(player.position);
    const team = canonTeam(player.team);
    byNamePosTeam.set(`${name}|${position}|${team}`, match);

    const namePos = `${name}|${position}`;
    const existing = byNamePos.get(namePos);
    if (existing && existing !== "ambiguous" && existing.adp !== match.adp) {
      byNamePos.set(namePos, "ambiguous");
    } else if (!existing) {
      byNamePos.set(namePos, match);
    }

    if (position === "DEF" && team) {
      byDefTeam.set(team, match);
    }
  }

  return { byNamePosTeam, byNamePos, byDefTeam };
}

export function matchFfc(
  name: string,
  position: string,
  team: string,
  index: FfcIndex,
): FfcMatch | null {
  const pos = canonPosition(position);
  const tm = canonTeam(team);
  const normalized = normalizeName(name);

  const exact = index.byNamePosTeam.get(`${normalized}|${pos}|${tm}`);
  if (exact) return exact;

  if (pos === "DEF" && tm) {
    const defense = index.byDefTeam.get(tm);
    if (defense) return defense;
  }

  const loose = index.byNamePos.get(`${normalized}|${pos}`);
  if (loose && loose !== "ambiguous") return loose;
  return null;
}

type FfcResponse = {
  status?: string;
  players?: FfcAdpPlayer[];
};

async function fetchFfcAdp(
  format: string,
  teams: number,
  year: number,
): Promise<FfcAdpPlayer[]> {
  const url = `https://fantasyfootballcalculator.com/api/v1/adp/${format}?teams=${teams}&year=${year}&position=all`;
  const raw = await fetchText(url);
  const data = JSON.parse(raw) as FfcResponse;
  if (!Array.isArray(data.players)) {
    throw new Error("FFC ADP response was missing players");
  }
  return data.players;
}

export async function getFfcAdp(opts: {
  scoringType: ScoringType;
  superflex: boolean;
  teams: number;
  year: number;
}): Promise<FfcAdpPlayer[]> {
  const format = ffcFormat(opts.scoringType, opts.superflex);
  const teams = nearestFfcTeams(opts.teams);
  const year = opts.year;
  try {
    return await loadDayCache(
      `ffc-adp-${format}-${teams}-${year}.json`,
      () => fetchFfcAdp(format, teams, year),
    );
  } catch {
    return [];
  }
}
