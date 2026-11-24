import "server-only";

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import type {
  Fixture,
  FormGame,
  LastXI,
  MatchSummary,
  Meta,
  Performance,
  PlayersData,
  Ranking,
  Result,
  TeamProfile,
} from "./types";

// JSON written by the Python pipeline (`football-predictor run`). Read at build time only.
const DATA_DIR = path.join(process.cwd(), "public", "data");
const BUILD_DATA_DIR = path.join(process.cwd(), "build-data");

/**
 * Parse each file once per build worker. (React's cache() only lasts for one page render,
 * which would re-read the multi-megabyte files for each of the ~3,000 pages.)
 */
const memo = new Map<string, unknown>();

function readJson<T>(full: string, fallback: T): T {
  if (!memo.has(full)) {
    memo.set(full, existsSync(full) ? JSON.parse(readFileSync(full, "utf-8")) : fallback);
  }
  return memo.get(full) as T;
}

const data = (file: string) => path.join(DATA_DIR, file);

const EMPTY_STATS = { n: 0, byCompetition: [], calibration: [] };

export const getFixtures = (): Fixture[] =>
  readJson<{ fixtures: Fixture[] }>(data("fixtures.json"), { fixtures: [] }).fixtures;

export const getResults = (): Result[] =>
  readJson<{ results: Result[] }>(data("results.json"), { results: [] }).results;

/**
 * Both teams' last 10 matches with statistics, keyed by match id. Written by the pipeline
 * to web/build-data (not public): only the static build reads it.
 */
export const getMatchHistory = (): Record<string, { home: FormGame[]; away: FormGame[] }> =>
  readJson(path.join(BUILD_DATA_DIR, "match-stats.json"), {});

export const getPerformance = (): Performance =>
  readJson<Performance>(data("performance.json"), {
    generatedAt: "",
    windows: { "7d": EMPTY_STATS, "30d": EMPTY_STATS, "90d": EMPTY_STATS, all: EMPTY_STATS },
    daily: [],
  });

export const getMeta = (): Meta =>
  readJson<Meta>(data("meta.json"), {
    generatedAt: "",
    model: {},
    valueEdge: 0.1,
    competitions: [],
    counts: { matchesInDatabase: 0, trackedPredictions: 0, settled: 0, upcoming: 0 },
    dataRange: { from: "", to: "" },
  });

export type Evaluation = {
  generatedAt: string;
  testPeriod: string;
  rows: { model: string; n: number; accuracy: number; logLoss: number; brier: number; rps: number }[];
  topFeatures: { feature: string; importance: number }[];
};

/** Written by notebooks/02_modelling.ipynb (walk-forward validation). Optional. */
export const getEvaluation = (): Evaluation | null => readJson<Evaluation | null>(data("evaluation.json"), null);

export const getRanking = (): Ranking => readJson<Ranking>(data("ranking.json"), { generatedAt: "", valueDate: null, clubs: [] });

export const getPlayers = (): PlayersData => readJson<PlayersData>(data("players.json"), { generatedAt: "", competitions: {} });

/** Line-ups and events of results, and each team's previous starting XI before a fixture. */
export const getLineups = (): {
  results: Record<string, MatchSummary>;
  lastXI: Record<string, { home?: LastXI; away?: LastXI }>;
} => readJson(path.join(BUILD_DATA_DIR, "lineups.json"), { results: {}, lastXI: {} });

/** Team pages (build time only): slug -> profile. */
export const getTeams = (): Record<string, TeamProfile> => readJson(path.join(BUILD_DATA_DIR, "teams.json"), {});
