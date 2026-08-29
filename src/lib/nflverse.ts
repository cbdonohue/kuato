import { fetchText, loadDayCache } from "./cache";
import { parseCsv } from "./csv";

const STATS_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_reg_${season}.csv`;
const SNAPS_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/snap_counts/snap_counts_${season}.csv`;
const IDS_URL =
  "https://raw.githubusercontent.com/dynastyprocess/data/master/files/db_playerids.csv";

const SKILL = new Set(["QB", "RB", "WR", "TE", "K"]);

export type NflversePlayerSeason = {
  season: number;
  games: number;
  fantasyStd: number;
  fantasyPpr: number;
  snapPct: number | null;
  position: string;
  passingYards: number;
  passingTds: number;
  interceptions: number;
  rushingYards: number;
  rushingTds: number;
  receptions: number;
  receivingYards: number;
  receivingTds: number;
};

export type NflverseBundle = {
  season: number;
  byGsis: Record<string, NflversePlayerSeason>;
  sleeperToGsis: Record<string, string>;
};

export const EMPTY_NFLVERSE: NflverseBundle = {
  season: 0,
  byGsis: {},
  sleeperToGsis: {},
};

function num(value: string | undefined): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function usableId(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "NA" || trimmed === "na") return null;
  return trimmed;
}

export function parsePlayerIds(csv: string): {
  sleeperToGsis: Record<string, string>;
  gsisToPfr: Record<string, string>;
} {
  const sleeperToGsis: Record<string, string> = {};
  const gsisToPfr: Record<string, string> = {};
  for (const row of parseCsv(csv)) {
    const sleeper = usableId(row.sleeper_id);
    const gsis = usableId(row.gsis_id);
    const pfr = usableId(row.pfr_id);
    if (sleeper && gsis) sleeperToGsis[sleeper] = gsis;
    if (gsis && pfr) gsisToPfr[gsis] = pfr;
  }
  return { sleeperToGsis, gsisToPfr };
}

export function parseSnapShares(csv: string): Record<string, number> {
  const sums: Record<string, { pct: number; games: number }> = {};
  for (const row of parseCsv(csv)) {
    const pfr = usableId(row.pfr_player_id);
    const position = (row.position ?? "").toUpperCase();
    if (!pfr || !SKILL.has(position) || position === "K") continue;
    const snaps = num(row.offense_snaps);
    if (snaps <= 0) continue;
    let pct = num(row.offense_pct);
    if (pct > 1) pct = pct / 100;
    const entry = sums[pfr] ?? { pct: 0, games: 0 };
    entry.pct += pct;
    entry.games += 1;
    sums[pfr] = entry;
  }
  const out: Record<string, number> = {};
  for (const [pfr, entry] of Object.entries(sums)) {
    if (entry.games > 0) out[pfr] = (entry.pct / entry.games) * 100;
  }
  return out;
}

export function parsePlayerStats(
  csv: string,
  season: number,
): Record<string, NflversePlayerSeason> {
  const byGsis: Record<string, NflversePlayerSeason> = {};
  for (const row of parseCsv(csv)) {
    const gsis = usableId(row.player_id);
    const position = (row.position ?? "").toUpperCase();
    if (!gsis || !SKILL.has(position)) continue;
    byGsis[gsis] = {
      season,
      games: num(row.games),
      fantasyStd: num(row.fantasy_points),
      fantasyPpr: num(row.fantasy_points_ppr),
      snapPct: null,
      position,
      passingYards: num(row.passing_yards),
      passingTds: num(row.passing_tds),
      interceptions: num(row.passing_interceptions),
      rushingYards: num(row.rushing_yards),
      rushingTds: num(row.rushing_tds),
      receptions: num(row.receptions),
      receivingYards: num(row.receiving_yards),
      receivingTds: num(row.receiving_tds),
    };
  }
  return byGsis;
}

export function assembleNflverseBundle(opts: {
  season: number;
  statsCsv: string;
  snapsCsv: string;
  idsCsv: string;
}): NflverseBundle {
  const { sleeperToGsis, gsisToPfr } = parsePlayerIds(opts.idsCsv);
  const byGsis = parsePlayerStats(opts.statsCsv, opts.season);
  const snaps = parseSnapShares(opts.snapsCsv);
  for (const [gsis, player] of Object.entries(byGsis)) {
    const pfr = gsisToPfr[gsis];
    if (pfr != null && snaps[pfr] != null) {
      player.snapPct = snaps[pfr];
    }
  }
  return { season: opts.season, byGsis, sleeperToGsis };
}

async function fetchNflverseBundle(season: number): Promise<NflverseBundle> {
  let resolved = season;
  let statsCsv: string;
  try {
    statsCsv = await fetchText(STATS_URL(season));
  } catch {
    resolved = season - 1;
    statsCsv = await fetchText(STATS_URL(resolved));
  }
  const [snapsCsv, idsCsv] = await Promise.all([
    fetchText(SNAPS_URL(resolved)).catch(() => ""),
    fetchText(IDS_URL).catch(() => ""),
  ]);
  return assembleNflverseBundle({
    season: resolved,
    statsCsv,
    snapsCsv,
    idsCsv,
  });
}

export async function getNflverseSeason(season: number): Promise<NflverseBundle> {
  if (!Number.isFinite(season) || season < 2000) return EMPTY_NFLVERSE;
  try {
    return await loadDayCache(`nflverse-${season}.json`, () =>
      fetchNflverseBundle(season),
    );
  } catch {
    return EMPTY_NFLVERSE;
  }
}
