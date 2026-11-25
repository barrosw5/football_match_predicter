"use client";

import { useMemo, useState } from "react";

import { int, num, pct, signed } from "@/lib/format";
import { LocalDate, T } from "@/lib/i18n";
import type { Outcome, Performance, WindowKey } from "@/lib/types";

import { CalibrationChart } from "./charts/calibration-chart";
import { CompetitionBars } from "./charts/competition-bars";
import { DailyChart } from "./charts/daily-chart";
import { ModelVsMarket } from "./model-vs-market";
import { ResultsTable } from "./results-table";
import { StatTile } from "./stat-tile";

const WINDOWS: { key: WindowKey; en: string; pt: string; days: number | null }[] = [
  { key: "7d", en: "7 days", pt: "7 dias", days: 7 },
  { key: "30d", en: "30 days", pt: "30 dias", days: 30 },
  { key: "90d", en: "90 days", pt: "90 dias", days: 90 },
  { key: "all", en: "All time", pt: "Sempre", days: null },
];

const OUTCOME_NAMES: Record<Outcome, { en: string; pt: string }> = {
  H: { en: "Home win", pt: "Vitória da casa" },
  D: { en: "Draw", pt: "Empate" },
  A: { en: "Away win", pt: "Vitória de fora" },
};

export function PerformanceView({ perf, valueEdge }: { perf: Performance; valueEdge: number }) {
  const [windowKey, setWindowKey] = useState<WindowKey>("30d");
  const win = WINDOWS.find((w) => w.key === windowKey)!;
  const s = perf.windows[windowKey];

  const daily = useMemo(() => {
    const cutoff = win.days === null ? null : Date.parse(perf.generatedAt) - win.days * 864e5;
    return perf.daily.filter((d) => cutoff === null || Date.parse(`${d.date}T23:59:59Z`) >= cutoff);
  }, [perf, win]);

  const allTime = win.days === null && (perf.monthly?.length ?? 0) > 1;
  const live = s.sources?.live ?? 0;
  const backtest = s.sources?.backtest ?? 0;
  const card = "rounded-2xl border border-line bg-surface p-4 sm:p-5";

  return (
    <div>
      <div className="-mx-4 mb-6 border-b border-line px-4 py-3 sm:-mx-6 sm:px-6">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" className="flex w-full rounded-lg border border-line bg-surface p-0.5 sm:w-auto">
            {WINDOWS.map((w) => (
              <button
                key={w.key}
                type="button"
                aria-pressed={w.key === windowKey}
                onClick={() => setWindowKey(w.key)}
                className={`flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors sm:flex-none ${
                  w.key === windowKey ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
                }`}
              >
                <T en={w.en} pt={w.pt} />
              </button>
            ))}
          </div>
          {s.n > 0 && (
            <span className="text-sm text-ink-2">
              <T
                en={`${int(s.n)} settled forecasts${backtest ? ` · ${int(live)} live, ${int(backtest)} from the backtest` : ""}`}
                pt={`${int(s.n)} previsões avaliadas${backtest ? ` · ${int(live)} em direto, ${int(backtest)} da simulação` : ""}`}
              />
            </span>
          )}
        </div>
        {backtest > 0 && s.since && (
          <p className="mt-2 max-w-3xl text-xs leading-5 text-ink-3">
            <T en="From" pt="Desde" /> <LocalDate iso={`${s.since}T12:00:00Z`} kind="full" />.{" "}
            <T
              en="Backtest: each week was predicted by a model trained only on the matches before it, as if it had been running then. Live: forecasts saved before kick-off."
              pt="Simulação: cada semana foi prevista por um modelo treinado só com os jogos anteriores, como se já estivesse a funcionar nessa altura. Em direto: previsões guardadas antes do apito inicial."
            />
          </p>
        )}
      </div>

      {s.n === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-ink-2">
          <T en="No settled forecasts in this period yet." pt="Ainda não há previsões avaliadas neste período." />
        </p>
      ) : (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <StatTile
              label={<T en="Correct picks" pt="Previsões certas" />}
              value={pct(s.accuracy, 1)}
              detail={<T en={`${int(s.correct)} of ${int(s.n)} matches`} pt={`${int(s.correct)} de ${int(s.n)} jogos`} />}
            />
            <StatTile
              label={<T en="Bookmakers' favourite" pt="Favorito das casas" />}
              value={pct(s.market?.accuracy, 1)}
              detail={
                <T
                  en={`model ${pct(s.market?.modelAccuracy, 1)} on the same ${int(s.market?.n)} games`}
                  pt={`modelo ${pct(s.market?.modelAccuracy, 1)} nos mesmos ${int(s.market?.n)} jogos`}
                />
              }
            />
            <StatTile
              label={<T en="Goal error per team" pt="Erro de golos por equipa" />}
              value={num(s.goalMae, 2)}
              detail={
                <T
                  en={`exact score hit ${int(s.exactScores)} times (${pct((s.exactScores ?? 0) / s.n, 1)})`}
                  pt={`resultado exato ${int(s.exactScores)} vezes (${pct((s.exactScores ?? 0) / s.n, 1)})`}
                />
              }
            />
            <StatTile
              label={<T en="Probability on the real result" pt="Probabilidade no resultado real" />}
              value={pct(s.avgPActual, 1)}
              detail={`Brier ${num(s.brier, 3)} · RPS ${num(s.rps, 3)}`}
            />
          </section>

          <div className="mt-4">
            <section className={card}>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="font-semibold">
                  {allTime ? <T en="Month by month" pt="Mês a mês" /> : <T en="Day by day" pt="Dia a dia" />}
                </h2>
                <ul className="flex gap-4 text-xs text-ink-2">
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--good)]" aria-hidden="true" />
                    <T en="Correct" pt="Certos" />
                  </li>
                  <li className="flex items-center gap-1.5">
                    <span className="inline-block h-2.5 w-2.5 rounded-[2px] bg-[var(--bad)]" aria-hidden="true" />
                    <T en="Missed" pt="Errados" />
                  </li>
                </ul>
              </div>
              <div className="mt-4">
                {allTime ? <DailyChart days={perf.monthly!} unit="month" /> : <DailyChart days={daily} />}
              </div>
            </section>
          </div>

          <div className="mt-4 grid grid-cols-1 items-start gap-4 lg:grid-cols-2">
            <div className="grid min-w-0 grid-cols-1 content-start gap-4">
            {s.market && <ModelVsMarket m={s.market} />}
              <section className={card}>
                <h2 className="font-semibold">
                  <T en="Value picks" pt="Apostas de valor" />
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  <T
                    en={`A 1-unit bet whenever the model's expected value beat ${pct(valueEdge)} at the quoted odds.`}
                    pt={`Aposta de 1 unidade sempre que o valor esperado do modelo superou ${pct(valueEdge)} às odds oferecidas.`}
                  />
                </p>
                <dl className="tnum mt-4 grid grid-cols-3 gap-3 text-sm">
                  <div>
                    <dt className="text-xs text-ink-2">
                      <T en="Bets" pt="Apostas" />
                    </dt>
                    <dd className="text-lg font-semibold">{int(s.value?.bets)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-2">
                      <T en="Won" pt="Ganhas" />
                    </dt>
                    <dd className="text-lg font-semibold">{int(s.value?.won)}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-ink-2">
                      <T en="Return" pt="Retorno" />
                    </dt>
                    <dd className="text-lg font-semibold">
                      {s.value?.roi === null ? "–" : signed((s.value?.roi ?? 0) * 100, 1, "%")}
                    </dd>
                  </div>
                </dl>
                <p className="mt-3 text-xs leading-5 text-ink-2">
                  <T
                    en="Bookmaker prices are hard to beat: when the model disagrees strongly with them, the market is usually right. Reported as-is."
                    pt="É difícil bater as odds das casas: quando o modelo discorda muito delas, normalmente são as casas que têm razão. Mostrado tal como é."
                  />
                </p>
              </section>
            </div>
            <div className="grid min-w-0 grid-cols-1 content-start gap-4">
              <section className={card}>
                <h2 className="font-semibold">
                  <T en="What it picked" pt="O que escolheu" />
                </h2>
                <p className="mt-1 text-sm text-ink-2">
                  <T
                    en="Picks are the single most likely outcome, so draws are rarely chosen even though they happen in about a quarter of games."
                    pt="A previsão é o resultado mais provável, por isso o empate quase nunca é escolhido, apesar de acontecer em cerca de um quarto dos jogos."
                  />
                </p>
                <div className="scroll-x -mx-4 mt-4 px-4 sm:mx-0 sm:px-0">
                <table className="tnum w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-ink-3">
                      <th className="pb-2 font-normal">
                        <T en="Outcome" pt="Resultado" />
                      </th>
                      <th className="pb-2 text-right font-normal">
                        <T en="Picked" pt="Escolhido" />
                      </th>
                      <th className="pb-2 text-right font-normal">
                        <T en="Right" pt="Certo" />
                      </th>
                      <th className="pb-2 text-right font-normal">
                        <T en="Happened" pt="Aconteceu" />
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(["H", "D", "A"] as Outcome[]).map((o) => {
                      const b = s.byOutcome?.[o];
                      return (
                        <tr key={o}>
                          <td className="py-2">
                            <T en={OUTCOME_NAMES[o].en} pt={OUTCOME_NAMES[o].pt} />
                          </td>
                          <td className="py-2 text-right">{int(b?.predicted)}</td>
                          <td className="py-2 text-right">{b && b.predicted ? pct(b.correct / b.predicted) : "–"}</td>
                          <td className="py-2 text-right text-ink-2">{b ? pct(b.actual / s.n) : "–"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                </div>
              </section>
              <section className={card}>
                <h2 className="font-semibold">
                  <T en="Are the probabilities honest?" pt="As probabilidades são fiáveis?" />
                </h2>
                <p className="mb-3 mt-1 text-sm text-ink-2">
                  <T
                    en="Every home, draw and away probability, grouped in 10% bins."
                    pt="Todas as probabilidades de casa, empate e fora, agrupadas em intervalos de 10%."
                  />
                </p>
                <CalibrationChart bins={s.calibration} />
              </section>
            </div>
          </div>

          <div className="mt-4">
            <section className={card}>
              <h2 className="font-semibold">
                <T en="By competition" pt="Por competição" />
              </h2>
              <p className="mb-4 mt-1 text-sm text-ink-2">
                <T en="Share of correct picks." pt="Percentagem de previsões certas." />
              </p>
              <CompetitionBars rows={s.byCompetition} overall={s.accuracy} />
            </section>
          </div>
        </>
      )}

      <section className="mt-10">
        <h2 className="text-lg font-semibold">
          <T en="Every forecast" pt="Todas as previsões" />
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          <T
            en="The model's pick before kick-off, the bookmakers' favourite and the final score."
            pt="A previsão do modelo antes do jogo, o favorito das casas de apostas e o resultado final."
          />
        </p>
        <ResultsTable days={win.days} generatedAt={perf.generatedAt} />
      </section>
    </div>
  );
}
