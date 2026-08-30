import { fetchText, loadDayCache } from "./cache";
import { parseCsv } from "./csv";

const INJURIES_URL = (season: number) =>
  `https://github.com/nflverse/nflverse-data/releases/download/injuries/injuries_${season}.csv`;

export const MIN_SPELLS = 20;
const SEASONS = 3;

const PART_NEEDLES: Array<[string, string]> = [
  ["hamstring", "hamstring"],
  ["quadricep", "quad"],
  ["quad", "quad"],
  ["achilles", "achilles"],
  ["concussion", "concussion"],
  ["shoulder", "shoulder"],
  ["pectoral", "pectoral"],
  ["abdomen", "abdomen"],
  ["abdominal", "abdomen"],
  ["groin", "groin"],
  ["ankle", "ankle"],
  ["wrist", "wrist"],
  ["elbow", "elbow"],
  ["finger", "hand"],
  ["thumb", "hand"],
  ["hand", "hand"],
  ["knee", "knee"],
  ["calf", "calf"],
  ["foot", "foot"],
  ["toe", "foot"],
  ["back", "back"],
  ["neck", "neck"],
  ["hip", "hip"],
  ["rib", "ribs"],
  ["ribs", "ribs"],
];

const SKIP = /\b(illness|rest|personal|covid|load management|not injury|undisclosed)\b/;

export type InjuryTypical = {
  part: string;
  label: string;
  median: number;
  p25: number;
  p75: number;
  n: number;
};

export type InjuryTable = Record<string, InjuryTypical>;

export type InjuryWeek = {
  gsisId: string;
  season: number;
  week: number;
  part: string;
  missed: boolean;
};

function usable(value: string | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === "NA" || trimmed === "na") return null;
  return trimmed;
}

export function normalizeInjuryPart(raw: string | null | undefined): string | null {
  const text = (raw ?? "").toLowerCase().trim();
  if (!text || SKIP.test(text)) return null;
  for (const [needle, key] of PART_NEEDLES) {
    if (text.includes(needle)) return key;
  }
  return null;
}

export function injuryPartLabel(part: string): string {
  return part.charAt(0).toUpperCase() + part.slice(1);
}

export function isMissedStatus(status: string | null | undefined): boolean {
  const value = (status ?? "").trim().toLowerCase();
  return (
    value === "out" ||
    value === "doubtful" ||
    value === "ir" ||
    value === "injured reserve" ||
    value === "pup"
  );
}

export function parseInjuryWeeks(csv: string): InjuryWeek[] {
  const rows: InjuryWeek[] = [];
  for (const row of parseCsv(csv)) {
    const seasonType = (row.season_type ?? "").toUpperCase();
    if (seasonType && seasonType !== "REG") continue;
    const gsisId = usable(row.gsis_id);
    const week = Number(row.week);
    const season = Number(row.season);
    const part = normalizeInjuryPart(row.report_primary_injury);
    if (!gsisId || !part || !Number.isFinite(week) || !Number.isFinite(season)) {
      continue;
    }
    rows.push({
      gsisId,
      season,
      week,
      part,
      missed: isMissedStatus(row.report_status),
    });
  }
  return rows;
}

export function injurySpells(weeks: InjuryWeek[]): number[] {
  const grouped = new Map<string, number[]>();
  for (const row of weeks) {
    if (!row.missed) continue;
    const key = `${row.gsisId}|${row.season}|${row.part}`;
    const list = grouped.get(key) ?? [];
    list.push(row.week);
    grouped.set(key, list);
  }
  const lengths: number[] = [];
  for (const list of grouped.values()) {
    const unique = [...new Set(list)].sort((a, b) => a - b);
    let start = unique[0];
    let prev = unique[0];
    for (let i = 1; i <= unique.length; i += 1) {
      const week = unique[i];
      const gap = week == null || week > prev + 1;
      if (gap) {
        lengths.push(prev - start + 1);
        start = week;
      }
      prev = week;
    }
  }
  return lengths;
}

function quantile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

export function buildInjuryTable(
  weeks: InjuryWeek[],
  minSpells = MIN_SPELLS,
): InjuryTable {
  const byPart = new Map<string, InjuryWeek[]>();
  for (const row of weeks) {
    const list = byPart.get(row.part) ?? [];
    list.push(row);
    byPart.set(row.part, list);
  }
  const table: InjuryTable = {};
  for (const [part, partWeeks] of byPart) {
    const spells = injurySpells(partWeeks).sort((a, b) => a - b);
    if (spells.length < minSpells) continue;
    table[part] = {
      part,
      label: injuryPartLabel(part),
      median: Math.round(quantile(spells, 0.5)),
      p25: Math.round(quantile(spells, 0.25)),
      p75: Math.round(quantile(spells, 0.75)),
      n: spells.length,
    };
  }
  return table;
}

export function formatTypicalMissed(typical: InjuryTypical): string {
  const low = Math.min(typical.p25, typical.median);
  const high = Math.max(typical.p75, typical.median);
  if (low !== high) {
    return `typically ${low}–${high} games historically`;
  }
  const noun = typical.median === 1 ? "game" : "games";
  return `typically ${typical.median} ${noun} historically`;
}

export function lookupTypical(
  table: InjuryTable | null | undefined,
  bodyPart: string | null | undefined,
): InjuryTypical | null {
  const part = normalizeInjuryPart(bodyPart);
  if (!part || !table) return null;
  return table[part] ?? null;
}

function injurySeasons(latest: number): number[] {
  return Array.from({ length: SEASONS }, (_, i) => latest - i);
}

async function fetchInjuryCsvs(latest: number): Promise<string[]> {
  const texts = await Promise.all(
    injurySeasons(latest).map((season) =>
      fetchText(INJURIES_URL(season)).catch(() => ""),
    ),
  );
  return texts.filter((text) => text.length > 0);
}

export function tableFromCsvs(csvs: string[], minSpells = MIN_SPELLS): InjuryTable {
  const weeks = csvs.flatMap((csv) => parseInjuryWeeks(csv));
  return buildInjuryTable(weeks, minSpells);
}

export async function getInjuryTable(latestSeason: number): Promise<InjuryTable> {
  if (!Number.isFinite(latestSeason) || latestSeason < 2009) return {};
  try {
    return await loadDayCache(`injuries-${latestSeason}.json`, async () => {
      const csvs = await fetchInjuryCsvs(latestSeason);
      return tableFromCsvs(csvs);
    });
  } catch {
    return {};
  }
}
