// Shapes of the JSON files written by `football_predictor.export` (Python).

export type Outcome = "H" | "D" | "A";

export interface Competition {
  code: string;
  name: string;
  country: string;
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
}

export interface Team {
  name: string;
  key: string;
  elo: number | null;
  /** Last matches before kick-off, oldest first. */
  form?: FormGame[];
  logo?: string | null; // ESPN team id (crest)
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
