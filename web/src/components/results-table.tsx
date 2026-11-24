"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { num, pct } from "@/lib/format";
import { competitionName, LocalDate, OutcomeName, T } from "@/lib/i18n";
import type { Result } from "@/lib/types";

import { SourceTag, Verdict } from "./badges";
import { CompetitionPicker } from "./competition-picker";
import { TeamLogo } from "./team-logo";

const PAGE = 25;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const FILTERS = [
  { id: "all", en: "All", pt: "Todos" },
  { id: "correct", en: "Correct", pt: "Certos" },
  { id: "missed", en: "Missed", pt: "Errados" },
  { id: "exact", en: "Exact score", pt: "Resultado exato" },
] as const;

/** Chance of one exact score under the two independent Poisson goal counts. */
const poisson = (k: number, l: number) => {
  let p = Math.exp(-l);
  for (let i = 1; i <= k; i++) p *= l / i;
  return p;
};

/** Every settled forecast, loaded on demand from the static results.json. */
export function ResultsTable({ days, generatedAt }: { days: number | null; generatedAt: string }) {
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["id"]>("all");
  const [competition, setCompetition] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`${BASE}/data/results.json`)
      .then((r) => r.json())
      .then((d: { results: Result[] }) => setResults(d.results))
      .catch(() => setError(true));
  }, []);

  const inWindow = useMemo(() => {
    if (!results) return [];
    if (days === null) return results;
    // Same window definition as performance.json: relative to when the data was exported.
    const cutoff = Date.parse(generatedAt) - days * 864e5;
    return results.filter((r) => Date.parse(r.kickoff) >= cutoff);
  }, [results, days, generatedAt]);

  const competitions = useMemo(() => {
    const m = new Map<string, Result["competition"]>();
    inWindow.forEach((r) => m.set(r.competition.code, r.competition));
    return [...m.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [inWindow]);

  const rows = useMemo(
    () =>
      inWindow.filter(
        (r) =>
          (filter === "all" || (filter === "exact" ? r.exactScore : filter === "correct" ? r.correct : !r.correct)) &&
          (!competition || r.competition.code === competition),
      ),
    [inWindow, filter, competition],
  );
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  if (error)
    return (
      <p className="text-sm text-ink-2">
        <T en="Could not load the results file." pt="Não foi possível carregar os resultados." />
      </p>
    );

  return (
    <div className={results ? "" : "opacity-60"}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" className="flex rounded-lg border border-line bg-surface p-0.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              aria-pressed={filter === f.id}
              onClick={() => {
                setFilter(f.id);
                setPage(0);
              }}
              className={`rounded-md px-3 py-1.5 text-sm ${filter === f.id ? "bg-surface-2 font-medium" : "text-ink-2 hover:text-ink"}`}
            >
              <T en={f.en} pt={f.pt} />
            </button>
          ))}
        </div>
        <CompetitionPicker
          competitions={competitions}
          value={competition}
          onChange={(c) => {
            setCompetition(c);
            setPage(0);
          }}
        />
        <span className="tnum ml-auto text-sm text-ink-3">
          {rows.length} <T en="forecasts" pt="previsões" />
        </span>
      </div>

      {/* On large screens the page itself scrolls the table, so the header can stay pinned. */}
      <div className="overflow-x-auto rounded-xl border border-line bg-surface lg:overflow-visible">
        <table className="tnum w-full min-w-[60rem] text-sm">
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-surface [&_th]:shadow-[inset_0_-1px_0_var(--line)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
            <tr className="text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-normal">
                <T en="Date" pt="Data" />
              </th>
              <th className="px-2 py-2.5 text-center font-normal">
                <T en="Match and final score" pt="Jogo e resultado final" />
              </th>
              <th className="px-2 py-2.5 font-normal">
                <T en="Model prediction" pt="Previsão do modelo" />
              </th>
              <th className="px-2 py-2.5 font-normal">
                <T en="Bookmakers' favourite" pt="Favorito das casas" />
              </th>
              <th className="px-2 py-2.5 text-right font-normal">
                <T en="Winner" pt="Vencedor" />
              </th>
              <th className="px-2 py-2.5 text-center font-normal">
                <T en="Most likely score" pt="Resultado mais provável" />
              </th>
              <th className="px-2 py-2.5 text-right font-normal">
                <T en="Exact score" pt="Resultado exato" />
              </th>
              <th className="px-4 py-2.5 text-right font-normal">
                <T en="Goal error" pt="Erro de golos" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!results &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={8} className="px-4 py-3 text-ink-3">
                    {i === 0 ? <T en="Loading…" pt="A carregar…" /> : " "}
                  </td>
                </tr>
              ))}
            {shown.map((r) => {
              const homeWon = r.score.home > r.score.away;
              const awayWon = r.score.away > r.score.home;
              const pickProb = r.pick === "H" ? r.probs.home : r.pick === "D" ? r.probs.draw : r.probs.away;
              const [ph, pa] = r.predScore.split("-").map(Number);
              const scoreProb = poisson(ph, r.xg.home) * poisson(pa, r.xg.away);
              return (
                <tr key={r.id} className="hover:bg-surface-2">
                  <td className="whitespace-nowrap px-4 py-3 align-top text-ink-2">
                    <LocalDate iso={r.kickoff} kind="dayMonth" />
                    <span className="mt-0.5 flex items-center gap-1 text-xs text-ink-3">
                      <T
                        en={competitionName(r.competition.code, r.competition.name, "en")}
                        pt={competitionName(r.competition.code, r.competition.name, "pt")}
                      />
                    </span>
                  </td>
                  <td className="px-2 py-3">
                    <Link
                      href={`/match/${r.id}/`}
                      className="grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-3 hover:underline"
                    >
                      <span className={`flex min-w-0 items-center justify-end gap-2 ${homeWon ? "font-semibold" : ""}`}>
                        <span className="truncate">{r.home.name}</span>
                        <TeamLogo id={r.home.logo} name={r.home.name} size={20} />
                      </span>
                      <span className="rounded-md bg-surface-2 px-2 py-0.5 font-semibold">
                        {r.score.home}–{r.score.away}
                      </span>
                      <span className={`flex min-w-0 items-center gap-2 ${awayWon ? "font-semibold" : ""}`}>
                        <TeamLogo id={r.away.logo} name={r.away.name} size={20} />
                        <span className="truncate">{r.away.name}</span>
                      </span>
                    </Link>
                  </td>
                  <td className="max-w-52 px-2 py-3">
                    <span className="block truncate font-medium">
                      <OutcomeName outcome={r.pick} home={r.home.name} away={r.away.name} homeLogo={r.home.logo} awayLogo={r.away.logo} />
                    </span>
                    <span className="flex items-center gap-1.5 text-xs text-ink-3">
                      {pct(pickProb)}
                      <SourceTag source={r.source} />
                    </span>
                  </td>
                  <td className="max-w-44 px-2 py-3">
                    {r.marketPick ? (
                      <>
                        <span className="block truncate text-ink-2">
                          <OutcomeName outcome={r.marketPick} home={r.home.name} away={r.away.name} homeLogo={r.home.logo} awayLogo={r.away.logo} />
                        </span>
                        <span className={`text-xs ${r.marketCorrect ? "text-good-ink" : "text-bad-ink"}`}>
                          {r.marketCorrect ? <T en="right" pt="acertou" /> : <T en="wrong" pt="falhou" />}
                        </span>
                      </>
                    ) : (
                      <span className="text-xs text-ink-3">
                        <T en="no odds" pt="sem odds" />
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Verdict correct={r.correct} />
                  </td>
                  <td className="px-2 py-3 text-center">
                    {r.predScore.replace("-", "–")}
                    <span className="block text-xs text-ink-3">{pct(scoreProb)}</span>
                  </td>
                  <td className="px-2 py-3 text-right">
                    <Verdict correct={r.exactScore} />
                  </td>
                  <td className="px-4 py-3 text-right">{num(r.goalError, 1)}</td>
                </tr>
              );
            })}
            {results && shown.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-ink-2">
                  <T en="Nothing matches these filters." pt="Nada corresponde a estes filtros." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="Winner and exact score are judged separately. The most likely score can be a draw while a win is the most likely outcome: a draw needs one of few scores (1–1, 0–0), a win is spread over many (1–0, 2–1, 2–0…), so a single score rarely passes 15%. Goal error = distance between the expected goals and the real score, both teams added up."
          pt="Vencedor e resultado exato são avaliados em separado. O resultado mais provável pode ser um empate mesmo quando a vitória é o desfecho mais provável: o empate concentra-se em poucos resultados (1–1, 0–0) e a vitória divide-se por muitos (1–0, 2–1, 2–0…), por isso um único resultado raramente passa dos 15%. Erro de golos = diferença entre os golos esperados e o resultado real, somando as duas equipas."
        />
      </p>

      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 disabled:opacity-40"
          >
            <T en="Previous" pt="Anterior" />
          </button>
          <span className="tnum text-ink-2">
            {current + 1} / {pages}
          </span>
          <button
            type="button"
            disabled={current >= pages - 1}
            onClick={() => setPage(current + 1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 disabled:opacity-40"
          >
            <T en="Next" pt="Seguinte" />
          </button>
        </div>
      )}
    </div>
  );
}
