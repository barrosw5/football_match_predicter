// Correct-score probabilities from the model's expected goals, mirroring
// `football_predictor.model.score_matrix` (two independent Poisson variables).

function poissonPmf(k: number, lambda: number): number {
  let p = Math.exp(-lambda);
  for (let i = 1; i <= k; i++) p *= lambda / i;
  return p;
}

export function scoreMatrix(lambdaHome: number, lambdaAway: number, maxGoals = 6): number[][] {
  const h = Array.from({ length: maxGoals }, (_, i) => poissonPmf(i, lambdaHome));
  const a = Array.from({ length: maxGoals }, (_, j) => poissonPmf(j, lambdaAway));
  return h.map((ph) => a.map((pa) => ph * pa));
}

export function topScores(matrix: number[][], n = 5): { home: number; away: number; p: number }[] {
  const cells = matrix.flatMap((row, i) => row.map((p, j) => ({ home: i, away: j, p })));
  return cells.sort((x, y) => y.p - x.p).slice(0, n);
}

/** P(both teams score) and P(over 2.5 goals) under the same Poisson model. */
export function goalMarkets(lambdaHome: number, lambdaAway: number) {
  const btts = (1 - Math.exp(-lambdaHome)) * (1 - Math.exp(-lambdaAway));
  const total = lambdaHome + lambdaAway;
  const under = poissonPmf(0, total) + poissonPmf(1, total) + poissonPmf(2, total);
  return { btts, over25: 1 - under };
}
