import { getCoachNote, rosterHoleLabels, shouldAskCoach } from "./coach";
import { buildEnrichmentIndex } from "./enrich";
import { getFfcAdp } from "./ffc";
import { getNflverseSeason } from "./nflverse";
import {
  detectUnsupported,
  fillRosterSlots,
  invertDraftOrder,
  isSuperflex,
  nextPickNumber,
  picksUntilRosterOnClock,
  recommend,
  rosterForPick,
  scoringFromSettings,
  slotForPick,
  toPlayerView,
} from "./recommend";
import {
  getDraft,
  getDraftPicks,
  getLeague,
  getLeagueRosters,
  getLeagueUsers,
  getNflPlayers,
  getTradedPicks,
  getUser,
} from "./sleeper";
import type {
  ClockView,
  EnrichmentIndex,
  LiveState,
  PlayerView,
  RecentPickView,
  ScoringType,
  SleeperDraft,
  SleeperLeague,
  SleeperLeagueUser,
  SleeperPick,
  SleeperPlayer,
  SleeperRoster,
  SleeperUser,
} from "./types";

function draftName(draft: SleeperDraft, league: SleeperLeague | null): string {
  return draft.metadata?.name || league?.name || `Draft ${draft.draft_id}`;
}

function rosterPositionsFor(
  draft: SleeperDraft,
  league: SleeperLeague | null,
): string[] {
  if (league?.roster_positions?.length) return league.roster_positions;
  const settings = draft.settings;
  const slots: string[] = [];
  const push = (pos: string, count = 0) => {
    for (let i = 0; i < count; i += 1) slots.push(pos);
  };
  push("QB", settings.slots_qb ?? 0);
  push("RB", settings.slots_rb ?? 0);
  push("WR", settings.slots_wr ?? 0);
  push("TE", settings.slots_te ?? 0);
  push("FLEX", settings.slots_flex ?? 0);
  push("SUPER_FLEX", settings.slots_super_flex ?? 0);
  push("K", settings.slots_k ?? 0);
  push("DEF", settings.slots_def ?? 0);
  push("BN", settings.slots_bn ?? 0);
  return slots;
}

function resolveUserSlot(
  user: SleeperUser,
  draft: SleeperDraft,
  rosters: SleeperRoster[],
  picks: SleeperPick[],
): { slot: number | null; rosterId: number | null } {
  const slot = draft.draft_order?.[user.user_id] ?? null;
  if (slot != null) {
    const rosterId = draft.slot_to_roster_id?.[String(slot)] ?? null;
    return { slot, rosterId: rosterId == null ? null : Number(rosterId) };
  }

  const owned = rosters.find((roster) => roster.owner_id === user.user_id);
  if (owned) {
    const fromMap = Object.entries(draft.slot_to_roster_id ?? {}).find(
      ([, rosterId]) => Number(rosterId) === Number(owned.roster_id),
    );
    return {
      slot: fromMap ? Number(fromMap[0]) : null,
      rosterId: Number(owned.roster_id),
    };
  }

  const ownPick = picks.find((pick) => pick.picked_by === user.user_id);
  if (ownPick) {
    return { slot: ownPick.draft_slot ?? null, rosterId: Number(ownPick.roster_id) };
  }

  return { slot: null, rosterId: null };
}

function displayNameFor(
  userId: string | null,
  users: SleeperLeagueUser[],
  self: SleeperUser,
  fallbackSlot?: number | null,
): string {
  if (userId) {
    if (userId === self.user_id) return self.display_name || self.username;
    const match = users.find((entry) => entry.user_id === userId);
    if (match?.display_name || match?.username) {
      return match.display_name || match.username || userId;
    }
    return userId;
  }
  if (fallbackSlot != null && fallbackSlot > 0) {
    return `Bot · Slot ${fallbackSlot}`;
  }
  return "Unknown manager";
}

function userIdForRoster(
  rosterId: number | null,
  rosters: SleeperRoster[],
  slotToUser: Record<number, string>,
  slot: number | null,
): string | null {
  if (rosterId != null) {
    const owned = rosters.find((roster) => Number(roster.roster_id) === Number(rosterId));
    if (owned?.owner_id) return owned.owner_id;
  }
  if (slot != null) return slotToUser[slot] ?? null;
  return null;
}

function resolvePickManager(
  pick: SleeperPick,
  opts: {
    user: SleeperUser;
    users: SleeperLeagueUser[];
    rosters: SleeperRoster[];
    slotToUser: Record<number, string>;
    userRosterId: number | null;
  },
): { userId: string | null; displayName: string; isYou: boolean } {
  const slot = pick.draft_slot ?? null;
  const rosterId =
    pick.roster_id === "" || pick.roster_id == null
      ? null
      : Number(pick.roster_id);
  const userId =
    (pick.picked_by && pick.picked_by.trim()) ||
    userIdForRoster(rosterId, opts.rosters, opts.slotToUser, slot) ||
    null;

  return {
    userId,
    displayName: displayNameFor(userId, opts.users, opts.user, slot),
    isYou:
      userId === opts.user.user_id ||
      (opts.userRosterId != null &&
        rosterId != null &&
        rosterId === opts.userRosterId),
  };
}

function buildClock(opts: {
  draft: SleeperDraft;
  picks: SleeperPick[];
  user: SleeperUser;
  users: SleeperLeagueUser[];
  rosters: SleeperRoster[];
  userRosterId: number | null;
  tradedPicks: import("./types").SleeperTradedPick[];
}): ClockView {
  const teams = opts.draft.settings.teams;
  const rounds = opts.draft.settings.rounds;
  const pickNo = nextPickNumber(opts.picks);
  const totalPicks = teams * rounds;
  const round = Math.min(rounds, Math.ceil(Math.max(pickNo, 1) / teams));
  const clockInput = {
    teams,
    rounds,
    draftType: opts.draft.type,
    slotToRoster: opts.draft.slot_to_roster_id ?? {},
    tradedPicks: opts.tradedPicks,
    season: opts.draft.season,
  };

  if (pickNo > totalPicks) {
    return {
      pickNo: totalPicks,
      round: rounds,
      totalPicks,
      onTheClock: null,
      picksUntilUser: null,
      nextUserPickNo: null,
    };
  }

  const onRoster = rosterForPick(pickNo, clockInput);
  const slot = slotForPick(pickNo, teams, opts.draft.type);
  const slotToUser = invertDraftOrder(opts.draft.draft_order);
  const onUserId = userIdForRoster(onRoster, opts.rosters, slotToUser, slot);

  const until =
    opts.userRosterId != null
      ? picksUntilRosterOnClock(pickNo, opts.userRosterId, clockInput)
      : { picksUntil: null, nextPickNoForRoster: null };

  return {
    pickNo,
    round,
    totalPicks,
    onTheClock: {
      userId: onUserId,
      displayName: displayNameFor(onUserId, opts.users, opts.user, slot),
      slot,
      rosterId: onRoster,
      isYou: opts.userRosterId != null && onRoster === opts.userRosterId,
    },
    picksUntilUser: until.picksUntil,
    nextUserPickNo: until.nextPickNoForRoster,
  };
}

function availableBoard(
  picks: SleeperPick[],
  players: Record<string, SleeperPlayer>,
  extras?: EnrichmentIndex | null,
): PlayerView[] {
  const drafted = new Set(picks.map((pick) => pick.player_id));
  const list: PlayerView[] = [];
  for (const [id, player] of Object.entries(players)) {
    if (drafted.has(id)) continue;
    const pos = player.position ?? "";
    if (!["QB", "RB", "WR", "TE", "K", "DEF"].includes(pos)) continue;
    if (player.status && player.status !== "Active" && pos !== "DEF") continue;
    const view = toPlayerView(player, id, undefined, extras);
    if (view.rank > 350) continue;
    list.push(view);
  }
  list.sort((a, b) => a.rank - b.rank);
  return list.slice(0, 250);
}

export async function buildLiveState(
  draftId: string,
  username: string,
): Promise<LiveState> {
  const user = await getUser(username);
  const [draft, picks, tradedPicks, players] = await Promise.all([
    getDraft(draftId),
    getDraftPicks(draftId),
    getTradedPicks(draftId),
    getNflPlayers(),
  ]);

  const draftYear = Number(draft.season);
  const lastSeasonYear =
    Number.isFinite(draftYear) && draftYear > 2000
      ? draftYear - 1
      : new Date().getFullYear() - 1;
  const nflversePromise = getNflverseSeason(lastSeasonYear);

  let league: SleeperLeague | null = null;
  let users: SleeperLeagueUser[] = [];
  let rosters: SleeperRoster[] = [];
  if (draft.league_id) {
    try {
      [league, users, rosters] = await Promise.all([
        getLeague(draft.league_id),
        getLeagueUsers(draft.league_id),
        getLeagueRosters(draft.league_id),
      ]);
    } catch {
      league = null;
    }
  }

  const scoringType: ScoringType = scoringFromSettings(
    draft.metadata?.scoring_type,
    league?.scoring_settings?.rec,
  );
  const positions = rosterPositionsFor(draft, league);
  const superflex = isSuperflex(positions);
  const ffcYear =
    Number.isFinite(draftYear) && draftYear > 2000 ? draftYear : lastSeasonYear + 1;

  const [ffcPlayers, nflverse] = await Promise.all([
    getFfcAdp({
      scoringType,
      superflex,
      teams: draft.settings.teams,
      year: ffcYear,
    }),
    nflversePromise,
  ]);
  const extras = buildEnrichmentIndex(players, ffcPlayers, nflverse, scoringType);

  const { rosterId: userRosterId } = resolveUserSlot(
    user,
    draft,
    rosters,
    picks,
  );
  const unsupported = detectUnsupported({
    draftType: draft.type,
    leagueSettings: league?.settings,
  });

  const clock = buildClock({
    draft,
    picks,
    user,
    users,
    rosters,
    userRosterId,
    tradedPicks,
  });

  const userPicks =
    userRosterId != null
      ? picks.filter((pick) => Number(pick.roster_id) === Number(userRosterId))
      : [];
  const roster = fillRosterSlots(userPicks, positions, players, extras);

  const recommendations =
    unsupported || userRosterId == null
      ? []
      : recommend({
          teams: draft.settings.teams,
          rounds: draft.settings.rounds,
          draftType: draft.type,
          slotToRoster: draft.slot_to_roster_id ?? {},
          tradedPicks,
          season: draft.season,
          pickNo: nextPickNumber(picks),
          scoringType,
          rosterPositions: positions,
          userRosterId,
          picks,
          players,
          picksUntilUser: clock.picksUntilUser,
          extras,
        });

  const slotToUser = invertDraftOrder(draft.draft_order);
  const recentPicks: RecentPickView[] = [...picks]
    .sort((a, b) => b.pick_no - a.pick_no)
    .slice(0, 12)
    .map((pick) => {
      const manager = resolvePickManager(pick, {
        user,
        users,
        rosters,
        slotToUser,
        userRosterId,
      });
      return {
        pickNo: pick.pick_no,
        round: pick.round,
        player: toPlayerView(
          players[pick.player_id],
          pick.player_id,
          pick.metadata,
          extras,
        ),
        pickedByName: manager.displayName,
        isYou: manager.isYou,
      };
    });

  let coachNote: string | null = null;
  if (
    !unsupported &&
    shouldAskCoach(clock.picksUntilUser) &&
    recommendations.length > 0
  ) {
    coachNote = await getCoachNote({
      draftId,
      pickNo: clock.pickNo,
      scoringType,
      isSuperflex: superflex,
      leagueName: draftName(draft, league),
      picksUntilUser: clock.picksUntilUser,
      rosterHoles: rosterHoleLabels(roster),
      recommendations,
    });
  }

  return {
    user,
    draft: {
      draftId: draft.draft_id,
      name: draftName(draft, league),
      type: draft.type,
      status: draft.status,
      season: draft.season,
      teams: draft.settings.teams,
      rounds: draft.settings.rounds,
      scoringType,
      isSuperflex: superflex,
    },
    leagueName: league?.name || draft.metadata?.name || "Sleeper draft",
    unsupported,
    clock,
    roster,
    recommendations,
    coachNote,
    recentPicks,
    available: availableBoard(picks, players, extras),
  };
}
