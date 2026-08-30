import type {
  DraftType,
  EnrichmentIndex,
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
  extras?: EnrichmentIndex | null;
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

export function pickRosterId(
  pick: SleeperPick,
  slotToRoster: Record<string, number> = {},
): number | null {
  if (pick.roster_id !== "" && pick.roster_id != null) {
    const n = Number(pick.roster_id);
    return Number.isFinite(n) ? n : null;
  }
  if (pick.draft_slot == null) return null;
  const mapped = slotToRoster[String(pick.draft_slot)];
  if (mapped == null) return null;
  const n = Number(mapped);
  return Number.isFinite(n) ? n : null;
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

export function sleeperRankValue(player?: SleeperPlayer): number {
  return player?.search_rank && player.search_rank > 0 ? player.search_rank : 9999;
}

export function depthLabel(
  position?: string | null,
  order?: number | string | null,
): string | null {
  if (!position || order == null || order === "") return null;
  const n = Number(order);
  if (!Number.isFinite(n) || n < 1) return null;
  if (!SKILL_POSITIONS.has(position)) return null;
  return `${position}${n}`;
}

export function toPlayerView(
  player: SleeperPlayer | undefined,
  playerId: string,
  pickMeta?: { first_name?: string; last_name?: string; position?: string; team?: string },
  extras?: EnrichmentIndex | null,
): PlayerView {
  const nameFromMeta = [pickMeta?.first_name, pickMeta?.last_name]
    .filter(Boolean)
    .join(" ");
  const extra = extras?.get(playerId) ?? null;
  const sleeperRank = sleeperRankValue(player);
  const adp = extra?.adp && extra.adp > 0 ? extra.adp : null;
  const yearsExp = player?.years_exp ?? null;
  return {
    playerId,
    name: playerName(player, nameFromMeta || playerId),
    position: player?.position || pickMeta?.position || "—",
    team: player?.team || pickMeta?.team || "FA",
    rank: adp ?? sleeperRank,
    sleeperRank,
    adp,
    adpStdev: extra?.adpStdev ?? null,
    byeWeek: extra?.byeWeek ?? null,
    age: player?.age ?? null,
    yearsExp,
    rookie: yearsExp === 0,
    depth: depthLabel(player?.position, player?.depth_chart_order),
    lastSeason: extra?.lastSeason ?? null,
    injuryStatus: player?.injury_status ?? null,
    injuryNotes: player?.injury_notes ?? null,
    injuryBodyPart: player?.injury_body_part ?? null,
    practiceParticipation: player?.practice_participation ?? null,
    espnId:
      player?.espn_id == null || player.espn_id === ""
        ? null
        : String(player.espn_id),
  };
}

function truncateReason(text: string, max = 80): string {
  const trimmed = text.replace(/\s+/g, " ").trim();
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trimEnd()}…`;
}

function practiceLabel(value: string | null): string | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw || /^full$/i.test(raw)) return null;
  if (/did not participate/i.test(raw)) return "DNP";
  return raw.toLowerCase();
}

export function injuryReason(player: PlayerView): string | null {
  const status = player.injuryStatus?.trim();
  if (!status) return null;
  const part = player.injuryBodyPart?.trim();
  const practice = practiceLabel(player.practiceParticipation);
  const notes = player.injuryNotes?.trim();
  const bits = [status];
  if (part) bits.push(part);
  else if (notes) bits.push(truncateReason(notes));
  if (practice) bits.push(practice);
  if (bits.length === 1) return null;
  return bits.join(" · ");
}

export function injuryPenalty(status: string | null): number {
  const value = (status ?? "").trim().toLowerCase();
  if (value === "ir" || value === "pup") return 2.5;
  if (value === "out" || value === "suspended") return 2.0;
  if (value === "doubtful") return 1.0;
  if (value === "questionable") return 0.35;
  return 0;
}

const BENCH_LIKE = new Set(["BN", "IR", "TAXI"]);

const PPG_BASELINE: Record<ScoringType, Record<string, number>> = {
  ppr: { QB: 17, RB: 11, WR: 11.5, TE: 8.5 },
  half_ppr: { QB: 17, RB: 10.5, WR: 10, TE: 7.5 },
  std: { QB: 17, RB: 10, WR: 8.5, TE: 6.5 },
};

export function depthOrder(depth: string | null): number | null {
  if (!depth) return null;
  const match = /^(QB|RB|WR|TE)(\d+)$/.exec(depth);
  if (!match) return null;
  const order = Number(match[2]);
  return Number.isFinite(order) && order >= 1 ? order : null;
}

export function productionScore(player: PlayerView, scoringType: ScoringType): number {
  const ly = player.lastSeason;
  if (!ly || ly.games < 6) return 0;
  if (!SKILL_POSITIONS.has(player.position)) return 0;
  const baseline = PPG_BASELINE[scoringType][player.position];
  if (baseline == null) return 0;
  return clamp((ly.fantasyPts / ly.games - baseline) / 6, -0.9, 1.3);
}

export function snapScore(player: PlayerView): number {
  const snap = player.lastSeason?.snapPct;
  if (snap == null || !SKILL_POSITIONS.has(player.position)) return 0;
  if (snap >= 80) return 0.5;
  if (snap >= 65) return 0.3;
  if (snap >= 50) return 0.1;
  if (player.rookie) return 0;
  if (snap < 30) return -0.45;
  if (snap < 45) return -0.2;
  return 0;
}

export function depthScore(player: PlayerView): number {
  const order = depthOrder(player.depth);
  if (order == null) return 0;
  if (order === 1) return 0.4;
  if (order === 2) return 0.1;
  return -0.25;
}

export function adjustValueForStdev(value: number, adpStdev: number | null): number {
  if (adpStdev == null || adpStdev <= 0 || value <= 0) return value;
  if (adpStdev <= 3 && value > 0.5) return value * 1.08;
  return value * (1 - clamp((adpStdev - 3) / 18, 0, 0.45));
}

export function starterByeCounts(roster: RosterSlotView[]): Map<number, number> {
  const counts = new Map<number, number>();
  for (const entry of roster) {
    if (BENCH_LIKE.has(entry.slot) || !entry.player?.byeWeek) continue;
    const bye = entry.player.byeWeek;
    counts.set(bye, (counts.get(bye) ?? 0) + 1);
  }
  return counts;
}

export function byeClusterPenalty(player: PlayerView, sameByeStarters: number): number {
  if (player.byeWeek == null || LATE_ONLY.has(player.position)) return 0;
  if (sameByeStarters >= 3) return 1.2;
  if (sameByeStarters >= 2) return 0.85;
  if (sameByeStarters === 1) return 0.2;
  return 0;
}

function starterSlots(rosterPositions: string[]): string[] {
  return rosterPositions.filter((slot) => slot !== "BN" && slot !== "IR" && slot !== "TAXI");
}

export function fillRosterSlots(
  userPicks: SleeperPick[],
  rosterPositions: string[],
  players: Record<string, SleeperPlayer>,
  extras?: EnrichmentIndex | null,
): RosterSlotView[] {
  const slots: RosterSlotView[] = rosterPositions.map((slot) => ({
    slot,
    player: null,
  }));

  const assigned = new Set<string>();
  const ordered = [...userPicks].sort((a, b) => {
    const rankA = toPlayerView(players[a.player_id], a.player_id, undefined, extras).rank;
    const rankB = toPlayerView(players[b.player_id], b.player_id, undefined, extras).rank;
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
    const view = toPlayerView(
      players[pick.player_id],
      pick.player_id,
      pick.metadata,
      extras,
    );
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

function wantsPosition(
  holes: ReturnType<typeof remainingHoles>,
  position: string,
): boolean {
  if ((holes.dedicated[position] ?? 0) > 0) return true;
  if (holes.flex > 0 && FLEX_ELIGIBLE.has(position)) return true;
  if (holes.superflex > 0 && SUPERFLEX_ELIGIBLE.has(position)) return true;
  return false;
}

const DEMAND_POSITIONS = ["QB", "RB", "WR", "TE"] as const;

export function upcomingDemand(input: RecommendInput): {
  upcoming: number;
  counts: Record<string, number>;
  weights: Record<string, number>;
} {
  const counts: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const weights: Record<string, number> = { QB: 0, RB: 0, WR: 0, TE: 0 };
  const upcoming =
    input.picksUntilUser != null && input.picksUntilUser > 0
      ? input.picksUntilUser
      : 0;
  if (!upcoming) return { upcoming: 0, counts, weights };

  const clock: ClockInput = {
    teams: input.teams,
    rounds: input.rounds,
    draftType: input.draftType,
    slotToRoster: input.slotToRoster,
    tradedPicks: input.tradedPicks,
    season: input.season,
  };
  const superflex = isSuperflex(input.rosterPositions);
  const holeCache = new Map<number, ReturnType<typeof remainingHoles>>();

  for (let offset = 0; offset < upcoming; offset += 1) {
    const rosterId = rosterForPick(input.pickNo + offset, clock);
    if (rosterId == null) continue;
    let holes = holeCache.get(rosterId);
    if (!holes) {
      const rosterPicks = userPicksForRoster(
        input.picks,
        rosterId,
        input.slotToRoster,
      );
      holes = remainingHoles(
        fillRosterSlots(
          rosterPicks,
          input.rosterPositions,
          input.players,
          input.extras,
        ),
      );
      holeCache.set(rosterId, holes);
    }
    for (const position of DEMAND_POSITIONS) {
      if (!wantsPosition(holes, position)) continue;
      counts[position] += 1;
      const sfQb =
        superflex &&
        position === "QB" &&
        ((holes.dedicated.QB ?? 0) > 0 || holes.superflex > 0);
      weights[position] += sfQb ? 1.5 : 1;
    }
  }

  return { upcoming, counts, weights };
}

export function beforeYourPickSummary(input: RecommendInput): string | null {
  const { upcoming, counts } = upcomingDemand(input);
  if (!upcoming) return null;
  const parts = DEMAND_POSITIONS.filter((position) => counts[position] > 0).map(
    (position) => `${counts[position]} still need ${position}`,
  );
  if (parts.length === 0) {
    return `Before your pick: none of the next ${upcoming} picks have an obvious starter hole.`;
  }
  return `Before your pick: ${parts.join(", ")}.`;
}

const TIER_GAP = 8;

type TierBoost = {
  score: number;
  gap: number;
  last: boolean;
};

function tierBoosts(available: PlayerView[]): Map<string, TierBoost> {
  const byPosition = new Map<string, PlayerView[]>();
  for (const player of available) {
    if (!SKILL_POSITIONS.has(player.position)) continue;
    const list = byPosition.get(player.position) ?? [];
    list.push(player);
    byPosition.set(player.position, list);
  }

  const boosts = new Map<string, TierBoost>();
  for (const list of byPosition.values()) {
    const sorted = [...list].sort((a, b) => a.rank - b.rank);
    let start = 0;
    for (let index = 1; index <= sorted.length; index += 1) {
      const atEnd = index === sorted.length;
      const gap = atEnd ? 0 : sorted[index].rank - sorted[index - 1].rank;
      const cliff = !atEnd && gap >= TIER_GAP;
      if (!cliff && !atEnd) continue;
      if (cliff) {
        const lastIndex = index - 1;
        const roundedGap = Math.round(gap);
        boosts.set(sorted[lastIndex].playerId, {
          score: 1.4,
          gap: roundedGap,
          last: true,
        });
        if (lastIndex - 1 >= start) {
          boosts.set(sorted[lastIndex - 1].playerId, {
            score: 0.9,
            gap: roundedGap,
            last: false,
          });
        }
      }
      start = index;
    }
  }
  return boosts;
}

function stackPartner(
  player: PlayerView,
  roster: RosterSlotView[],
): PlayerView | null {
  if (LATE_ONLY.has(player.position) || !player.team || player.team === "FA") {
    return null;
  }
  const teammates = roster
    .map((entry) => entry.player)
    .filter((mate): mate is PlayerView => Boolean(mate && mate.team === player.team));
  if (player.position === "QB") {
    return teammates.find((mate) => mate.position === "WR" || mate.position === "TE") ?? null;
  }
  if (player.position === "WR" || player.position === "TE") {
    return teammates.find((mate) => mate.position === "QB") ?? null;
  }
  return null;
}

function demandScore(weight: number): number {
  if (weight <= 0) return 0;
  return clamp(weight * 0.55, 0, 2.2);
}

function reasonsFor(opts: {
  value: number;
  need: number;
  demandCount: number;
  upcoming: number;
  position: string;
  tier: TierBoost | undefined;
  stackName: string | null;
  injury: string | null;
  production: number;
  snap: number;
  snapPct: number | null;
  depth: string | null;
  sameByeStarters: number;
  byeWeek: number | null;
}): string[] {
  const reasons: string[] = [];
  if (opts.need >= 2) reasons.push("Fills a starter hole");
  else if (opts.need >= 1.2) reasons.push(`Helps ${opts.position} / flex depth`);
  if (opts.demandCount >= 1 && opts.upcoming >= 1) {
    reasons.push(
      `${opts.demandCount} of the next ${opts.upcoming} picks still need ${opts.position}`,
    );
  }
  if (opts.tier?.last) {
    reasons.push(
      `Last ${opts.position} before a ${opts.tier.gap}-pick ADP gap`,
    );
  }
  if (opts.stackName) reasons.push(`Stacks with ${opts.stackName}`);
  if (opts.injury) reasons.push(opts.injury);
  if (opts.value >= 1) reasons.push("Falling vs ADP");
  if (opts.production >= 0.55) reasons.push("Strong last season");
  if (opts.snap >= 0.3) {
    reasons.push(
      opts.snapPct != null
        ? `Workhorse snap share (${opts.snapPct}%)`
        : "Workhorse snap share",
    );
  } else if (opts.snap <= -0.3) {
    reasons.push(
      opts.snapPct != null
        ? `Limited snaps last year (${opts.snapPct}%)`
        : "Limited snaps last year",
    );
  }
  if (depthOrder(opts.depth) === 1 && opts.depth) {
    reasons.push(`Depth-chart ${opts.depth}`);
  }
  if (opts.sameByeStarters >= 2 && opts.byeWeek != null) {
    reasons.push(`Would be ${opts.sameByeStarters + 1} starters on bye ${opts.byeWeek}`);
  }
  if (reasons.length === 0) reasons.push("Best available on the board");
  return reasons;
}

export function recommend(input: RecommendInput): Recommendation[] {
  if (isAuction(input.draftType)) return [];

  const draftedIds = new Set(input.picks.map((pick) => pick.player_id));
  const currentRound = Math.ceil(input.pickNo / input.teams);
  const allowKickers = currentRound > input.rounds - 2;
  const superflex = isSuperflex(input.rosterPositions);

  const userPicks = userPicksForRoster(
    input.picks,
    input.userRosterId,
    input.slotToRoster,
  );
  const roster = fillRosterSlots(
    userPicks,
    input.rosterPositions,
    input.players,
    input.extras,
  );
  const holes = remainingHoles(roster);

  const available: PlayerView[] = [];
  for (const [id, player] of Object.entries(input.players)) {
    if (draftedIds.has(id)) continue;
    const position = player.position ?? "";
    if (!position) continue;
    if (player.status && player.status !== "Active" && position !== "DEF") continue;
    if (LATE_ONLY.has(position) && !allowKickers) continue;
    if (!SKILL_POSITIONS.has(position) && !LATE_ONLY.has(position)) continue;
    const view = toPlayerView(player, id, undefined, input.extras);
    if (view.rank > 400 && !LATE_ONLY.has(position)) continue;
    available.push(view);
  }

  const demand = upcomingDemand(input);
  const tiers = tierBoosts(available);
  const byeCounts = starterByeCounts(roster);

  const scored = available.map((player) => {
    const value = clamp((input.pickNo - player.rank) / 10, -2.5, 4);
    const valueAdj = adjustValueForStdev(value, player.adpStdev);
    const need = needScore(player.position, holes, input.scoringType, superflex);
    const demandWeight = demand.weights[player.position] ?? 0;
    const demandCount = demand.counts[player.position] ?? 0;
    const tier = tiers.get(player.playerId);
    const partner = stackPartner(player, roster);
    const stack = partner ? 1 : 0;
    const production = productionScore(player, input.scoringType);
    const snap = snapScore(player);
    const depth = depthScore(player);
    const sameByeStarters =
      player.byeWeek == null ? 0 : (byeCounts.get(player.byeWeek) ?? 0);
    const byePen = byeClusterPenalty(player, sameByeStarters);
    const total =
      valueAdj * 1.0 +
      need * 1.15 +
      demandScore(demandWeight) * 1.0 +
      (tier?.score ?? 0) * 0.9 +
      stack * 0.5 +
      production * 0.85 +
      snap * 0.7 +
      depth * 0.6 -
      byePen * 0.8 -
      injuryPenalty(player.injuryStatus);
    return {
      player,
      total,
      reasons: reasonsFor({
        value,
        need,
        demandCount,
        upcoming: demand.upcoming,
        position: player.position,
        tier,
        stackName: partner?.name ?? null,
        injury: injuryReason(player),
        production,
        snap,
        snapPct: player.lastSeason?.snapPct ?? null,
        depth: player.depth,
        sameByeStarters,
        byeWeek: player.byeWeek,
      }),
    };
  });

  scored.sort((a, b) => b.total - a.total);
  return scored.slice(0, 5).map(({ player, reasons }) => ({ player, reasons }));
}

export function userPicksForRoster(
  picks: SleeperPick[],
  rosterId: number,
  slotToRoster: Record<string, number> = {},
): SleeperPick[] {
  return picks.filter(
    (pick) => pickRosterId(pick, slotToRoster) === Number(rosterId),
  );
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
