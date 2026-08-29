export type ScoringType = "ppr" | "half_ppr" | "std";
export type DraftType = "snake" | "linear" | "auction";
export type DraftStatus = "pre_draft" | "drafting" | "complete" | string;
export type UnsupportedReason = "auction" | "dynasty" | null;

export type SleeperUser = {
  user_id: string;
  username: string;
  display_name: string;
  avatar: string | null;
};

export type SleeperNflState = {
  season: string;
  week?: number;
  season_type?: string;
};

export type SleeperDraftSettings = {
  teams: number;
  rounds: number;
  slots_wr?: number;
  slots_te?: number;
  slots_rb?: number;
  slots_qb?: number;
  slots_k?: number;
  slots_flex?: number;
  slots_super_flex?: number;
  slots_def?: number;
  slots_bn?: number;
  pick_timer?: number;
};

export type SleeperDraft = {
  draft_id: string;
  league_id: string | null;
  type: DraftType | string;
  status: DraftStatus;
  sport: string;
  season: string;
  season_type?: string;
  start_time: number | null;
  settings: SleeperDraftSettings;
  metadata?: {
    scoring_type?: string;
    name?: string;
    description?: string;
  } | null;
  draft_order?: Record<string, number> | null;
  slot_to_roster_id?: Record<string, number> | null;
};

export type SleeperPickMetadata = {
  team?: string;
  position?: string;
  player_id?: string;
  first_name?: string;
  last_name?: string;
  injury_status?: string;
  number?: string;
};

export type SleeperPick = {
  player_id: string;
  picked_by: string;
  roster_id: number | string;
  round: number;
  draft_slot: number;
  pick_no: number;
  metadata?: SleeperPickMetadata;
  is_keeper?: boolean | null;
  draft_id: string;
};

export type SleeperTradedPick = {
  season: string;
  round: number;
  roster_id: number;
  previous_owner_id?: number;
  owner_id: number;
};

export type SleeperLeague = {
  league_id: string;
  name: string;
  status: string;
  roster_positions: string[];
  scoring_settings?: Record<string, number>;
  settings?: Record<string, number | string | boolean | null>;
  previous_league_id?: string | null;
  draft_id?: string;
};

export type SleeperLeagueUser = {
  user_id: string;
  display_name: string;
  username?: string;
  avatar?: string | null;
};

export type SleeperRoster = {
  roster_id: number;
  owner_id: string | null;
  players?: string[] | null;
};

export type SleeperPlayer = {
  player_id: string;
  first_name?: string | null;
  last_name?: string | null;
  full_name?: string | null;
  position?: string | null;
  fantasy_positions?: string[] | null;
  team?: string | null;
  status?: string | null;
  injury_status?: string | null;
  injury_start_date?: string | null;
  search_rank?: number | null;
  number?: number | string | null;
  years_exp?: number | null;
  age?: number | null;
  college?: string | null;
  depth_chart_order?: number | null;
  depth_chart_position?: string | number | null;
  gsis_id?: string | null;
};

export type LastSeasonStats = {
  season: number;
  games: number;
  fantasyPts: number;
  snapPct: number | null;
  line: string;
};

export type PlayerExtras = {
  adp: number | null;
  adpStdev: number | null;
  byeWeek: number | null;
  lastSeason: LastSeasonStats | null;
};

export type EnrichmentIndex = Map<string, PlayerExtras>;

export type PlayerView = {
  playerId: string;
  name: string;
  position: string;
  team: string;
  rank: number;
  sleeperRank: number;
  adp: number | null;
  adpStdev: number | null;
  byeWeek: number | null;
  age: number | null;
  yearsExp: number | null;
  rookie: boolean;
  depth: string | null;
  lastSeason: LastSeasonStats | null;
  injuryStatus: string | null;
};

export type Recommendation = {
  player: PlayerView;
  reasons: string[];
};

export type RosterSlotView = {
  slot: string;
  player: PlayerView | null;
};

export type ClockView = {
  pickNo: number;
  round: number;
  totalPicks: number;
  onTheClock: {
    userId: string | null;
    displayName: string;
    slot: number | null;
    rosterId: number | null;
    isYou: boolean;
  } | null;
  picksUntilUser: number | null;
  nextUserPickNo: number | null;
};

export type RecentPickView = {
  pickNo: number;
  round: number;
  player: PlayerView;
  pickedByName: string;
  isYou: boolean;
};

export type LiveState = {
  user: SleeperUser;
  draft: {
    draftId: string;
    name: string;
    type: string;
    status: DraftStatus;
    season: string;
    teams: number;
    rounds: number;
    scoringType: ScoringType;
    isSuperflex: boolean;
  };
  leagueName: string;
  unsupported: UnsupportedReason;
  clock: ClockView;
  roster: RosterSlotView[];
  recommendations: Recommendation[];
  coachNote: string | null;
  recentPicks: RecentPickView[];
  available: PlayerView[];
};

export type DraftListItem = {
  draftId: string;
  leagueId: string | null;
  name: string;
  status: DraftStatus;
  type: string;
  scoringType: string;
  teams: number;
  rounds: number;
  startTime: number | null;
  season: string;
};
