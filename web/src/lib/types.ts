// Shapes of the JSON files written by `football_predictor.export` (Python).

export type Outcome = "H" | "D" | "A";

export interface Competition {
  code: string;
  name: string;
  country: string;
  logo?: string | null;
}

export interface Probs {
  home: number;
  draw: number;
  away: number;
}

export interface Odds {
  home: number;
  draw: number;
  away: number;
  source: string | null;
}

export interface ValuePick {
  outcome: Outcome;
  odds: number;
  edge: number;
}

/** One of a team's recent matches, from that team's point of view. */
export interface FormGame {
  date: string; // YYYY-MM-DD
  result: "W" | "D" | "L";
  goalsFor: number;
  goalsAgainst: number;
  home: boolean;
  opponent: string;
  opponentLogo: string | null;
  competition: string; // competition code
  /** Present on match pages (last 10 matches); null values = not recorded by the source. */
  stats?: MatchStats;
}

export interface MatchStats {
  xgFor: number | null;
  xgAgainst: number | null;
  shotsFor: number | null;
  shotsAgainst: number | null;
  sotFor: number | null;
  sotAgainst: number | null;
  cornersFor: number | null;
  cornersAgainst: number | null;
  yellow: number | null;
  red: number | null;
}

export interface Team {
  name: string;
  key: string;
  elo: number | null;
  /** Last matches before kick-off, oldest first. */
  form?: FormGame[];
  logo?: string | null; // ESPN team id (crest)
  /** Squad market value in EUR millions (Transfermarkt open data). */
  value?: number | null;
}

interface ForecastBase {
  id: string;
  kickoff: string; // ISO-8601, UTC
  competition: Competition;
  home: Team;
  away: Team;
  probs: Probs;
  xg: { home: number; away: number };
  pick: Outcome;
  odds: Odds | null;
  value: ValuePick | null;
  /** Bookmakers' margin-free probabilities and favourite (when odds exist). */
  market: { probs: Probs; pick: Outcome } | null;
  source: "live" | "backtest";
}

export interface Fixture extends ForecastBase {
  status: "upcoming" | "awaiting_result";
}

export interface Result extends ForecastBase {
  score: { home: number; away: number };
  actual: Outcome;
  correct: boolean;
  pActual: number;
  brier: number;
  goalError: number;
  predScore: string;
  exactScore: boolean;
  marketPick: Outcome | null;
  marketCorrect: boolean | null;
  valueProfit: number | null;
}

export interface WindowStats {
  n: number;
  correct?: number;
  accuracy?: number;
  brier?: number;
  logLoss?: number;
  rps?: number;
  goalMae?: number;
  exactScores?: number;
  avgPActual?: number;
  market?: {
    n: number;
    accuracy: number | null;
    modelAccuracy: number | null;
    correct?: number;
    modelCorrect?: number;
    brier?: number;
    modelBrier?: number;
    pActual?: number;
    modelPActual?: number;
    agree?: number;
    disagree?: { n: number; model: number; market: number; neither: number };
  };
  value?: { bets: number; won: number; profit: number; roi: number | null };
  byOutcome?: Record<Outcome, { predicted: number; correct: number; actual: number }>;
  sources?: Partial<Record<"live" | "backtest", number>>;
  byCompetition: (Competition & { n: number; correct: number; accuracy: number; brier: number })[];
  calibration: { bin: number; predicted: number; observed: number; n: number }[];
}

export type WindowKey = "7d" | "30d" | "90d" | "all";

export interface Performance {
  generatedAt: string;
  windows: Record<WindowKey, WindowStats>;
  daily: { date: string; n: number; correct: number; brier: number }[];
}

export interface Meta {
  generatedAt: string;
  model: {
    trained_at?: string;
    n_train?: number;
    train_start?: string;
    train_end?: string;
    n_features?: number;
    version?: string;
  };
  valueEdge: number;
  competitions: (Competition & { kind: "league" | "cup" })[];
  counts: { matchesInDatabase: number; trackedPredictions: number; settled: number; upcoming: number };
  dataRange: { from: string; to: string };
}

// ---------------------------------------------------------------- ranking

export interface RankingClub {
  rank: number;
  key: string;
  name: string;
  logo: string | null;
  country: string | null;
  league: string | null; // competition code
  elo: number;
  change7: number | null; // places gained (+) or lost (-)
  change30: number | null;
  elo30: number | null; // rating change over 30 days
  lastPlayed: string;
  history: number[]; // rating after each of the last 10 matches
  value: number | null; // EUR millions
  valueChange12m: number | null;
  valueHistory: number[];
}

export interface Ranking {
  generatedAt: string;
  valueDate: string | null;
  clubs: RankingClub[];
}

// ---------------------------------------------------------------- players

export interface Leader {
  id?: string | null;
  name: string;
  team: string;
  teamLogo: string | null;
  matches: number | null;
  value: number;
}

export interface PlayersData {
  generatedAt: string;
  competitions: Record<string, { season: string | null; goals: Leader[]; assists: Leader[] }>;
}

// ---------------------------------------------------------------- line-ups

export interface LineupPlayer {
  id?: string | null; // ESPN athlete id
  place?: number | null; // formation slot (1 = goalkeeper)
  name: string;
  pos: string | null;
  jersey: string | null;
  starter: boolean;
  subIn: boolean;
  subOut: boolean;
}

export interface MatchEvent {
  minute: string | null;
  type: "goal" | "penalty" | "own_goal" | "yellow" | "red" | "sub";
  side: "home" | "away";
  player: string | null;
  other: string | null; // assist, or the player replaced
}

export interface MatchSummary {
  formations: { home?: string | null; away?: string | null };
  lineups: { home: LineupPlayer[]; away: LineupPlayer[] };
  events: MatchEvent[];
}

export interface LastXI {
  date: string;
  opponent: string;
  opponentLogo?: string | null;
  formation: string | null;
  players: LineupPlayer[];
}

// ---------------------------------------------------------------- team & player pages

export interface SquadPlayer {
  id: string;
  name: string;
  pos: string | null;
  posName: string | null;
  jersey: string | null;
  age: number | null;
  birth: string | null;
  nationality: string | null;
  heightCm: number | null;
  weightKg: number | null;
  goals?: number | null;
  assists?: number | null;
  apps?: number;
}

/** [date, competition, home (1/0), opponent, opponent slug, goals for, goals against, match page id, opponent logo id] */
export type HistoryRow = [string, string, number, string, string | null, number, number, string | null, string | null];

export interface TeamProfile {
  key: string;
  slug: string;
  name: string;
  logo: string | null;
  country: string | null;
  league: string | null;
  rank: number;
  elo: number;
  change7: number | null;
  change30: number | null;
  elo30: number | null;
  value: number | null;
  valueDate: string | null;
  valueHistory: { date: string; value: number }[];
  eloHistory: [string, number][];
  history: HistoryRow[];
  upcoming: {
    id: string;
    kickoff: string;
    competition: string;
    home: boolean;
    opponent: string;
    opponentSlug: string | null;
    opponentLogo: string | null;
    win: number;
    draw: number;
    loss: number;
  }[];
  record: {
    id: string | null;
    date: string;
    competition: string;
    home: boolean;
    opponent: string;
    opponentSlug: string | null;
    opponentLogo: string | null;
    goalsFor: number;
    goalsAgainst: number;
    pick: "H" | "D" | "A";
    correct: boolean;
  }[];
  squad: SquadPlayer[];
}

export interface PlayerAppearance {
  date: string;
  matchId: string | null;
  competition: string;
  home: boolean;
  opponent: string;
  opponentLogo: string | null;
  goalsFor: number | null;
  goalsAgainst: number | null;
  started: boolean;
  goals: number;
  assists: number;
  yellow: boolean;
  red: boolean;
  shots?: number | null;
  sot?: number | null;
}

export interface PlayerProfile extends SquadPlayer {
  value?: number | null;
  team: { slug: string; name: string; logo: string | null };
  season: { goals: Record<string, number>; assists: Record<string, number> };
  appearances: PlayerAppearance[];
}

export interface TableRow {
  id: string;
  name: string;
  pos: string | null;
  team: string;
  teamLogo: string | null;
  teamSlug: string | null;
  value: number | null;
  apps: number;
  starts: number;
  goals: number;
  assists: number;
  shots: number;
  sot: number;
  fouls: number;
  fouled: number;
  offsides: number;
  yellow: number;
  red: number;
  saves: number;
}

export interface PlayersTable {
  generatedAt: string;
  season: string | null;
  competitions: Record<string, TableRow[]>;
}
