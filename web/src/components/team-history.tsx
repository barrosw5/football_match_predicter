"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { competitionLabel, formatDate, T, tr } from "@/lib/i18n";
import type { HistoryRow } from "@/lib/types";
import { useLang } from "@/lib/use-lang";
import { TeamLogo } from "./team-logo";

const PAGE = 30;

const seasonOf = (date: string) => {
  const y = Number(date.slice(0, 4));
  const m = Number(date.slice(5, 7));
  const start = m >= 7 ? y : y - 1;
  return `${start}/${String((start + 1) % 100).padStart(2, "0")}`;
};

/** Every match of the club since 2014, filterable by season and competition. */
export function TeamHistory({ rows }: { rows: HistoryRow[] }) {
  const lang = useLang();
  const seasons = useMemo(() => [...new Set(rows.map((r) => seasonOf(r[0])))], [rows]);
  const [season, setSeason] = useState(seasons[0] ?? "");
  const [comp, setComp] = useState("");
  const [page, setPage] = useState(0);

  const inSeason = useMemo(() => rows.filter((r) => !season || seasonOf(r[0]) === season), [rows, season]);
  const comps = useMemo(() => [...new Set(inSeason.map((r) => r[1]))], [inSeason]);
  const filtered = useMemo(() => inSeason.filter((r) => !comp || r[1] === comp), [inSeason, comp]);
  const totals = useMemo(() => {
    const w = filtered.filter((r) => r[5] > r[6]).length;
    const d = filtered.filter((r) => r[5] === r[6]).length;
    return { w, d, l: filtered.length - w - d, gf: filtered.reduce((s, r) => s + r[5], 0), ga: filtered.reduce((s, r) => s + r[6], 0) };
  }, [filtered]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = filtered.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select
          aria-label={tr(lang, "Season", "Época")}
          value={season}
          onChange={(e) => {
            setSeason(e.target.value);
            setComp("");
            setPage(0);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm sm:flex-none"
        >
          <option value="">{tr(lang, "All seasons", "Todas as épocas")}</option>
          {seasons.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select
          aria-label={tr(lang, "Competition", "Competição")}
          value={comp}
          onChange={(e) => {
            setComp(e.target.value);
            setPage(0);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm sm:flex-none"
        >
          <option value="">{tr(lang, "Every competition", "Todas as competições")}</option>
          {comps.map((c) => (
            <option key={c} value={c}>
              {competitionLabel(c, lang)}
            </option>
          ))}
        </select>
        <span className="tnum ml-auto w-full text-right text-sm text-ink-2 sm:w-auto">
          {filtered.length} {tr(lang, "matches", "jogos")} · {totals.w}
          {tr(lang, "W", "V")} {totals.d}
          {tr(lang, "D", "E")} {totals.l}
          {tr(lang, "L", "D")} · {totals.gf}–{totals.ga}
        </span>
      </div>
      <div className="scroll-x rounded-xl border border-line">
        <table className="tnum w-full text-sm sm:min-w-[36rem]">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-3 py-2 font-normal">{tr(lang, "Date", "Data")}</th>
              <th className="hidden px-2 py-2 font-normal sm:table-cell">{tr(lang, "Competition", "Competição")}</th>
              <th className="px-2 py-2 font-normal">{tr(lang, "Opponent", "Adversário")}</th>
              <th className="px-2 py-2 text-center font-normal">{tr(lang, "Score", "Resultado")}</th>
              <th className="px-3 py-2 text-right font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r, i) => {
              const [date, competition, home, opponent, oppSlug, gf, ga, matchId, oppLogo] = r;
              const res = gf > ga ? "W" : gf === ga ? "D" : "L";
              return (
                <tr key={`${date}-${i}`} className="hover:bg-surface-2">
                  <td className="whitespace-nowrap px-3 py-1.5 text-ink-2">
                    {formatDate(`${date}T12:00:00Z`, "dayMonth", lang)}
                    <span className="max-sm:block max-sm:text-[11px] max-sm:text-ink-3"> {date.slice(0, 4)}</span>
                  </td>
                  <td className="hidden max-w-40 truncate px-2 py-1.5 text-xs text-ink-2 sm:table-cell">{competitionLabel(competition, lang)}</td>
                  <td className="max-w-[9rem] px-2 py-1.5 sm:max-w-56">
                    <span className="flex min-w-0 items-center gap-1.5">
                      <span className="w-5 shrink-0 text-xs text-ink-3">{home ? "vs" : tr(lang, "at", "em")}</span>
                      <TeamLogo id={oppLogo} name={opponent} size={16} />
                      {oppSlug ? (
                        <Link href={`/team/${oppSlug}/`} className="truncate hover:underline">
                          {opponent}
                        </Link>
                      ) : (
                        <span className="truncate">{opponent}</span>
                      )}
                    </span>
                    <span className="block truncate text-[11px] text-ink-3 sm:hidden">{competitionLabel(competition, lang)}</span>
                  </td>
                  <td className="whitespace-nowrap px-2 py-1.5 text-center">
                    <span className="font-semibold">
                      {gf}–{ga}
                    </span>{" "}
                    <span className={`text-xs ${res === "W" ? "text-good-ink" : res === "L" ? "text-bad-ink" : "text-ink-3"}`}>
                      {lang === "pt" ? { W: "V", D: "E", L: "D" }[res] : res}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 text-right text-xs sm:px-3">
                    {matchId && (
                      <Link href={`/match/${matchId}/`} className="text-accent hover:underline" aria-label={tr(lang, "Forecast", "Previsão")}>
                        <span className="hidden sm:inline">
                          <T en="forecast" pt="previsão" />
                        </span>
                        <span className="text-base sm:hidden" aria-hidden="true">›</span>
                      </Link>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {pages > 1 && (
        <div className="mt-3 flex items-center justify-end gap-2 text-sm">
          <button
            type="button"
            disabled={current === 0}
            onClick={() => setPage(current - 1)}
            className="rounded-md border border-line bg-surface px-3 py-1.5 disabled:opacity-40"
          >
            {tr(lang, "Previous", "Anterior")}
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
            {tr(lang, "Next", "Seguinte")}
          </button>
        </div>
      )}
    </div>
  );
}
