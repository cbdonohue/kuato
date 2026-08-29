import { indexFfcPlayers, matchFfc, type FfcAdpPlayer } from "./ffc";
import type { NflverseBundle, NflversePlayerSeason } from "./nflverse";
import type {
  EnrichmentIndex,
  LastSeasonStats,
  ScoringType,
  SleeperPlayer,
} from "./types";

function playerName(player: SleeperPlayer, fallbackId: string): string {
  if (player.full_name) return player.full_name;
  const parts = [player.first_name, player.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : fallbackId;
}

export function fantasyPointsFor(
  season: NflversePlayerSeason,
  scoringType: ScoringType,
): number {
  if (scoringType === "ppr") return season.fantasyPpr;
  if (scoringType === "std") return season.fantasyStd;
  return Math.round(((season.fantasyStd + season.fantasyPpr) / 2) * 10) / 10;
}

export function statLineFor(season: NflversePlayerSeason): string {
  const pos = season.position;
  if (pos === "QB") {
    return `${Math.round(season.passingYards)} yds, ${season.passingTds} TD, ${season.interceptions} INT`;
  }
  if (pos === "RB") {
    const parts = [`${Math.round(season.rushingYards)} rush`];
    if (season.receptions > 0) parts.push(`${season.receptions} rec`);
    const tds = season.rushingTds + season.receivingTds;
    if (tds > 0) parts.push(`${tds} TD`);
    return parts.join(", ");
  }
  if (pos === "K") {
    return `${season.games} g`;
  }
  return `${season.receptions} rec, ${Math.round(season.receivingYards)} yds, ${season.receivingTds} TD`;
}

function toLastSeason(
  season: NflversePlayerSeason,
  scoringType: ScoringType,
): LastSeasonStats {
  return {
    season: season.season,
    games: season.games,
    fantasyPts: Math.round(fantasyPointsFor(season, scoringType) * 10) / 10,
    snapPct: season.snapPct == null ? null : Math.round(season.snapPct),
    line: statLineFor(season),
  };
}

export function buildEnrichmentIndex(
  players: Record<string, SleeperPlayer>,
  ffcPlayers: FfcAdpPlayer[],
  nflverse: NflverseBundle,
  scoringType: ScoringType,
): EnrichmentIndex {
  const ffcIndex = indexFfcPlayers(ffcPlayers);
  const extras: EnrichmentIndex = new Map();

  for (const [id, player] of Object.entries(players)) {
    const name = playerName(player, id);
    const position = player.position ?? "";
    const team = player.team ?? "";
    const ffc = matchFfc(name, position, team, ffcIndex);
    const gsis =
      (player.gsis_id && player.gsis_id.trim()) ||
      nflverse.sleeperToGsis[id] ||
      null;
    const season = gsis ? nflverse.byGsis[gsis] : undefined;
    if (!ffc && !season) continue;
    extras.set(id, {
      adp: ffc?.adp ?? null,
      adpStdev: ffc?.adpStdev ?? null,
      byeWeek: ffc?.byeWeek ?? null,
      lastSeason: season ? toLastSeason(season, scoringType) : null,
    });
  }

  return extras;
}
