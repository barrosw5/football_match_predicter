import "server-only";

import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { cache } from "react";

import type { Fixture, Meta, Performance, Result } from "./types";

// JSON written by the Python pipeline (`football-predictor run`). Read at build time only.
const DATA_DIR = path.join(process.cwd(), "public", "data");

function readJson<T>(file: string, fallback: T): T {
  const full = path.join(DATA_DIR, file);
  if (!existsSync(full)) return fallback;
  return JSON.parse(readFileSync(full, "utf-8")) as T;
}

const EMPTY_STATS = { n: 0, byCompetition: [], calibration: [] };

export const getFixtures = cache((): Fixture[] => readJson<{ fixtures: Fixture[] }>("fixtures.json", { fixtures: [] }).fixtures);

export const getResults = cache((): Result[] => readJson<{ results: Result[] }>("results.json", { results: [] }).results);

export const getPerformance = cache(
  (): Performance =>
    readJson<Performance>("performance.json", {
      generatedAt: "",
      windows: { "7d": EMPTY_STATS, "30d": EMPTY_STATS, "90d": EMPTY_STATS, all: EMPTY_STATS },
      daily: [],
    }),
);

export const getMeta = cache(
  (): Meta =>
    readJson<Meta>("meta.json", {
      generatedAt: "",
      model: {},
      valueEdge: 0.1,
      competitions: [],
      counts: { matchesInDatabase: 0, trackedPredictions: 0, settled: 0, upcoming: 0 },
      dataRange: { from: "", to: "" },
    }),
);

export type Evaluation = {
  generatedAt: string;
  testPeriod: string;
  rows: { model: string; n: number; accuracy: number; logLoss: number; brier: number; rps: number }[];
  topFeatures: { feature: string; importance: number }[];
};

/** Written by notebooks/02_modelling.ipynb (walk-forward validation). Optional. */
export const getEvaluation = cache((): Evaluation | null => readJson<Evaluation | null>("evaluation.json", null));
