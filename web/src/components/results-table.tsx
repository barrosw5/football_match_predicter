"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { num, pct } from "@/lib/format";
import { competitionName, countryName, LocalDate, OutcomeName, T, tr } from "@/lib/i18n";
import type { Result } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { SourceTag, Verdict } from "./badges";
import { TeamLogo } from "./team-logo";

const PAGE = 25;
const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";

const FILTERS = [
  { id: "all", en: "All", pt: "Todos" },
  { id: "correct", en: "Correct", pt: "Certos" },
  { id: "missed", en: "Missed", pt: "Errados" },
] as const;

/** Every settled forecast, loaded on demand from the static results.json. */
export function ResultsTable({ days, generatedAt }: { days: number | null; generatedAt: string }) {
  const lang = useLang();
  const [results, setResults] = useState<Result[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<"all" | "correct" | "missed">("all");
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
          (filter === "all" || (filter === "correct" ? r.correct : !r.correct)) &&
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
        <select
          aria-label={tr(lang, "Competition", "Competição")}
          value={competition}
          onChange={(e) => {
            setCompetition(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">{tr(lang, "Every competition", "Todas as competições")}</option>
          {competitions.map((c) => (
            <option key={c.code} value={c.code}>
              {countryName(c.country, lang)} · {competitionName(c.code, c.name, lang)}
            </option>
          ))}
        </select>
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
              <th className="px-2 py-2.5 text-center font-normal">
                <T en="Predicted score" pt="Resultado previsto" />
              </th>
              <th className="px-2 py-2.5 text-right font-normal">
                <T en="Goal error" pt="Erro de golos" />
              </th>
              <th className="px-4 py-2.5 text-right font-normal">
                <T en="Verdict" pt="Avaliação" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!results &&
              Array.from({ length: 6 }, (_, i) => (
                <tr key={i}>
                  <td colSpan={7} className="px-4 py-3 text-ink-3">
                    {i === 0 ? <T en="Loading…" pt="A carregar…" /> : " "}
                  </td>
                </tr>
              ))}
            {shown.map((r) => {
              const homeWon = r.score.home > r.score.away;
              const awayWon = r.score.away > r.score.home;
              const pickProb = r.pick === "H" ? r.probs.home : r.pick === "D" ? r.probs.draw : r.probs.away;
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
                      <OutcomeName outcome={r.pick} home={r.home.name} away={r.away.name} />
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
                          <OutcomeName outcome={r.marketPick} home={r.home.name} away={r.away.name} />
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
                  <td className="px-2 py-3 text-center">{r.predScore.replace("-", "–")}</td>
                  <td className="px-2 py-3 text-right">{num(r.goalError, 1)}</td>
                  <td className="px-4 py-3 text-right">
                    <Verdict correct={r.correct} />
                  </td>
                </tr>
              );
            })}
            {results && shown.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-ink-2">
                  <T en="Nothing matches these filters." pt="Nada corresponde a estes filtros." />
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="Goal error = distance between the expected goals and the real score, both teams added up."
          pt="Erro de golos = diferença entre os golos esperados e o resultado real, somando as duas equipas."
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
