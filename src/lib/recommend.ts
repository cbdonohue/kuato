import type {
  DraftType,
  PlayerView,
  Recommendation,
  RosterSlotView,
  ScoringType,
  SleeperPick,
  SleeperPlayer,
  SleeperTradedPick,
  UnsupportedReason,
} from "./types";

const SKILL_POSITIONS = new Set(["QB", "RB", "WR", "TE"]);
const FLEX_ELIGIBLE = new Set(["RB", "WR", "TE"]);
const SUPERFLEX_ELIGIBLE = new Set(["QB", "RB", "WR", "TE"]);
const LATE_ONLY = new Set(["K", "DEF"]);

export type ClockInput = {
  teams: number;
  rounds: number;
  draftType: DraftType | string;
  slotToRoster: Record<string, number>;
  tradedPicks: SleeperTradedPick[];
  season?: string;
};

export type RecommendInput = ClockInput & {
  pickNo: number;
  scoringType: ScoringType;
  rosterPositions: string[];
  userRosterId: number;
  picks: SleeperPick[];
  players: Record<string, SleeperPlayer>;
  picksUntilUser: number | null;
};

export function isAuction(draftType: string): boolean {
  return draftType === "auction";
}

export function isDynastyLeague(
  settings?: Record<string, number | string | boolean | null>,
): boolean {
  if (!settings) return false;
  if (settings.type === 2 || settings.type === "2") return true;
  const taxi = Number(settings.taxi_slots ?? 0);
  return taxi > 0;
}

export function detectUnsupported(opts: {
  draftType: string;
  leagueSettings?: Record<string, number | string | boolean | null>;
}): UnsupportedReason {
  if (isAuction(opts.draftType)) return "auction";
  if (isDynastyLeague(opts.leagueSettings)) return "dynasty";
  return null;
}

export function scoringFromSettings(
  draftScoring?: string | null,
  rec?: number,
): ScoringType {
  const meta = (draftScoring ?? "").toLowerCase();
  if (meta === "ppr" || meta === "half_ppr" || meta === "std") {
    return meta;
  }
  if (rec != null && rec >= 0.9) return "ppr";
  if (rec != null && rec >= 0.4) return "half_ppr";
  return "std";
}

export function isSuperflex(rosterPositions: string[]): boolean {
  return rosterPositions.some(
    (slot) => slot === "SUPER_FLEX" || slot === "Q/W/R/T" || slot === "SUPERFLEX",
  );
}

export function slotForPick(
  pickNo: number,
  teams: number,
  draftType: DraftType | string,
): number {
  if (pickNo < 1 || teams < 1) return 0;
  const indexInRound = ((pickNo - 1) % teams) + 1;
  const round = Math.ceil(pickNo / teams);
  const snake = draftType === "snake" && round % 2 === 0;
  return snake ? teams - indexInRound + 1 : indexInRound;
}

export function rosterForPick(
  pickNo: number,
  input: ClockInput,
): number | null {
  const slot = slotForPick(pickNo, input.teams, input.draftType);
  if (!slot) return null;
  const original = input.slotToRoster[String(slot)];
  if (original == null) return null;
  const round = Math.ceil(pickNo / input.teams);
  const trade = input.tradedPicks.find((pick) => {
    if (pick.round !== round) return false;
    if (Number(pick.roster_id) !== Number(original)) return false;
    if (input.season && pick.season && String(pick.season) !== String(input.season)) {
      return false;
    }
    return true;
  });
  return trade ? Number(trade.owner_id) : Number(original);
}

export function nextPickNumber(picks: SleeperPick[]): number {
  if (picks.length === 0) return 1;
  return Math.max(...picks.map((pick) => pick.pick_no)) + 1;
}

export function picksUntilRosterOnClock(
  nextPickNo: number,
  rosterId: number,
  input: ClockInput,
): { picksUntil: number | null; nextPickNoForRoster: number | null } {
  const total = input.teams * input.rounds;
  if (nextPickNo > total) {
    return { picksUntil: null, nextPickNoForRoster: null };
  }
  for (let pickNo = nextPickNo; pickNo <= total; pickNo += 1) {
    if (rosterForPick(pickNo, input) === Number(rosterId)) {
      return {
        picksUntil: pickNo - nextPickNo,
        nextPickNoForRoster: pickNo,
      };
    }
  }
  return { picksUntil: null, nextPickNoForRoster: null };
}

export function playerName(player: SleeperPlayer | undefined, fallbackId: string): string {
  if (!player) return fallbackId;
  if (player.full_name) return player.full_name;
  const parts = [player.first_name, player.last_name].filter(Boolean);
  return parts.length ? parts.join(" ") : fallbackId;
}

export function toPlayerView(
  player: SleeperPlayer | undefined,
  playerId: string,
  pickMeta?: { first_name?: string; last_name?: string; position?: string; team?: string },
): PlayerView {
  const nameFromMeta = [pickMeta?.first_name, pickMeta?.last_name]
    .filter(Boolean)
    .join(" ");
  return {
    playerId,
    name: playerName(player, nameFromMeta || playerId),
    position: player?.position || pickMeta?.position || "—",
    team: player?.team || pickMeta?.team || "FA",
    rank: player?.search_rank && player.search_rank > 0 ? player.search_rank : 9999,
    injuryStatus: player?.injury_status ?? null,
  };
}

function starterSlots(rosterPositions: string[]): string[] {
  return rosterPositions.filter((slot) => slot !== "BN" && slot !== "IR" && slot !== "TAXI");
}

export function fillRosterSlots(
  userPicks: SleeperPick[],
  rosterPositions: string[],
  players: Record<string, SleeperPlayer>,
): RosterSlotView[] {
  const slots: RosterSlotView[] = rosterPositions.map((slot) => ({
    slot,
    player: null,
  }));

  const assigned = new Set<string>();
  const ordered = [...userPicks].sort((a, b) => {
    const rankA = players[a.player_id]?.search_rank ?? 9999;
    const rankB = players[b.player_id]?.search_rank ?? 9999;
    return rankA - rankB;
  });

  const tryAssign = (player: PlayerView, predicate: (slot: string) => boolean) => {
    const index = slots.findIndex(
      (entry) => !entry.player && predicate(entry.slot),
    );
    if (index === -1) return false;
    slots[index].player = player;
    assigned.add(player.playerId);
    return true;
  };

  for (const pick of ordered) {
    const view = toPlayerView(players[pick.player_id], pick.player_id, pick.metadata);
    const pos = view.position;
    if (tryAssign(view, (slot) => slot === pos)) continue;
    if (FLEX_ELIGIBLE.has(pos) && tryAssign(view, (slot) => slot === "FLEX" || slot === "W/R/T" || slot === "REC_FLEX")) {
      continue;
    }
    if (SUPERFLEX_ELIGIBLE.has(pos) && tryAssign(view, (slot) => slot === "SUPER_FLEX" || slot === "Q/W/R/T")) {
      continue;
    }
    if ((pos === "WR" || pos === "TE") && tryAssign(view, (slot) => slot === "REC_FLEX")) {
      continue;
    }
    tryAssign(view, (slot) => slot === "BN");
  }

  return slots;
}

function remainingHoles(roster: RosterSlotView[]): {
  dedicated: Record<string, number>;
  flex: number;
  superflex: number;
  bench: number;
} {
  const dedicated: Record<string, number> = {};
  let flex = 0;
  let superflex = 0;
  let bench = 0;
  for (const entry of roster) {
    if (entry.player) continue;
    if (entry.slot === "BN" || entry.slot === "IR" || entry.slot === "TAXI") {
      bench += 1;
      continue;
    }
    if (entry.slot === "FLEX" || entry.slot === "W/R/T" || entry.slot === "REC_FLEX") {
      flex += 1;
      continue;
    }
    if (entry.slot === "SUPER_FLEX" || entry.slot === "Q/W/R/T") {
      superflex += 1;
      continue;
    }
    dedicated[entry.slot] = (dedicated[entry.slot] ?? 0) + 1;
  }
  return { dedicated, flex, superflex, bench };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function needScore(
  position: string,
  holes: ReturnType<typeof remainingHoles>,
  scoringType: ScoringType,
  superflex: boolean,
): number {
  let score = 0.25;
  if ((holes.dedicated[position] ?? 0) > 0) {
    score = 2.4;
  } else if (holes.flex > 0 && FLEX_ELIGIBLE.has(position)) {
    score = 1.3;
  } else if (holes.superflex > 0 && SUPERFLEX_ELIGIBLE.has(position)) {
    score = position === "QB" ? 2.5 : 1.0;
  } else if (position === "QB" && !superflex) {
    score = 0.1;
  }

  if (scoringType === "ppr" && position === "WR") score *= 1.1;
  if (scoringType === "half_ppr" && position === "WR") score *= 1.05;
  if (scoringType === "ppr" && position === "TE") score *= 1.04;
  return score;
}

function scarcityScore(
  position: string,
  pickNo: number,
  available: PlayerView[],
  rosterPositions: string[],
  teams: number,
  draftedAtPos: number,
): number {
  const horizon = pickNo + 18;
  const eliteLeft = available.filter(
    (player) => player.position === position && player.rank <= horizon,
  ).length;
  const dedicatedPerTeam = rosterPositions.filter((slot) => slot === position).length;
  const remainingDedicated = dedicatedPerTeam * teams - draftedAtPos;
  if (eliteLeft === 0) return 0.15;
  if (eliteLeft <= Math.max(1, remainingDedicated * 0.5)) return 1.8;
  if (eliteLeft <= Math.max(1, remainingDedicated)) return 1.1;
  return 0.3;
}

function windowScore(
  rank: number,
  pickNo: number,
  picksUntilUser: number | null,
): number {
  if (!picksUntilUser || picksUntilUser <= 0) return 0;
  const nextUserPick = pickNo + picksUntilUser;
  if (rank + 6 < nextUserPick) return 1.4;
  if (rank < nextUserPick) return 0.6;
  return 0;
}

function reasonsFor(scores: Recommendation["scores"], position: string): string[] {
  const reasons: string[] = [];
  if (scores.value >= 1) reasons.push("Falling vs Sleeper rank");
  if (scores.need >= 2) reasons.push("Fills a starter hole");
  else if (scores.need >= 1.2) reasons.push(`Helps ${position} / flex depth`);
  if (scores.scarcity >= 1.2) reasons.push("Position is thinning");
  if (scores.window >= 1) reasons.push("Unlikely to last until your next pick");
  if (reasons.length === 0) reasons.push("Best available on the board");
  return reasons;
}

export function recommend(input: RecommendInput): Recommendation[] {
  if (isAuction(input.draftType)) return [];

  const draftedIds = new Set(input.picks.map((pick) => pick.player_id));
  const currentRound = Math.ceil(input.pickNo / input.teams);
  const allowKickers = currentRound > input.rounds - 2;
  const superflex = isSuperflex(input.rosterPositions);

  const userPicks = input.picks.filter(
    (pick) => Number(pick.roster_id) === Number(input.userRosterId),
  );
  const roster = fillRosterSlots(userPicks, input.rosterPositions, input.players);
  const holes = remainingHoles(roster);

  const available: PlayerView[] = [];
  for (const [id, player] of Object.entries(input.players)) {
    if (draftedIds.has(id)) continue;
    const position = player.position ?? "";
    if (!position) continue;
    if (player.status && player.status !== "Active" && position !== "DEF") continue;
    if (LATE_ONLY.has(position) && !allowKickers) continue;
    if (!SKILL_POSITIONS.has(position) && !LATE_ONLY.has(position)) continue;
    const rank = player.search_rank ?? 9999;
    if (rank > 400 && !LATE_ONLY.has(position)) continue;
    available.push(toPlayerView(player, id));
  }

  const draftedByPos: Record<string, number> = {};
  for (const pick of input.picks) {
    const pos =
      input.players[pick.player_id]?.position || pick.metadata?.position || "";
    if (!pos) continue;
    draftedByPos[pos] = (draftedByPos[pos] ?? 0) + 1;
  }

  const scored: Recommendation[] = available.map((player) => {
    const value = clamp((input.pickNo - player.rank) / 10, -2.5, 4);
    const need = needScore(player.position, holes, input.scoringType, superflex);
    const scarcity = scarcityScore(
      player.position,
      input.pickNo,
      available,
      input.rosterPositions,
      input.teams,
      draftedByPos[player.position] ?? 0,
    );
    const window = windowScore(player.rank, input.pickNo, input.picksUntilUser);
    const total = value * 1.0 + need * 1.15 + scarcity * 0.85 + window * 0.9;
    const scores = {
      value: round2(value),
      need: round2(need),
      scarcity: round2(scarcity),
      window: round2(window),
      total: round2(total),
    };
    return {
      player,
      scores,
      reasons: reasonsFor(scores, player.position),
    };
  });

  scored.sort((a, b) => b.scores.total - a.scores.total);
  return scored.slice(0, 5);
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

export function userPicksForRoster(
  picks: SleeperPick[],
  rosterId: number,
): SleeperPick[] {
  return picks.filter((pick) => Number(pick.roster_id) === Number(rosterId));
}

export function invertDraftOrder(
  draftOrder: Record<string, number> | null | undefined,
): Record<number, string> {
  const inverted: Record<number, string> = {};
  if (!draftOrder) return inverted;
  for (const [userId, slot] of Object.entries(draftOrder)) {
    inverted[Number(slot)] = userId;
  }
  return inverted;
}

export { starterSlots };
