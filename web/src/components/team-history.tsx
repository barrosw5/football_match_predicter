"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { competitionLabel, formatDate, T, tr } from "@/lib/i18n";
import type { HistoryRow } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

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
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
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
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">{tr(lang, "Every competition", "Todas as competições")}</option>
          {comps.map((c) => (
            <option key={c} value={c}>
              {competitionLabel(c, lang)}
            </option>
          ))}
        </select>
        <span className="tnum ml-auto text-sm text-ink-2">
          {filtered.length} {tr(lang, "matches", "jogos")} · {totals.w}
          {tr(lang, "W", "V")} {totals.d}
          {tr(lang, "D", "E")} {totals.l}
          {tr(lang, "L", "D")} · {totals.gf}–{totals.ga}
        </span>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line">
        <table className="tnum w-full min-w-[36rem] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-3 py-2 font-normal">{tr(lang, "Date", "Data")}</th>
              <th className="px-2 py-2 font-normal">{tr(lang, "Competition", "Competição")}</th>
              <th className="px-2 py-2 font-normal">{tr(lang, "Opponent", "Adversário")}</th>
              <th className="px-2 py-2 text-center font-normal">{tr(lang, "Score", "Resultado")}</th>
              <th className="px-3 py-2 text-right font-normal" />
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((r, i) => {
              const [date, competition, home, opponent, oppSlug, gf, ga, matchId] = r;
              const res = gf > ga ? "W" : gf === ga ? "D" : "L";
              return (
                <tr key={`${date}-${i}`} className="hover:bg-surface-2">
                  <td className="px-3 py-1.5 text-ink-2">
                    {formatDate(`${date}T12:00:00Z`, "dayMonth", lang)} {date.slice(0, 4)}
                  </td>
                  <td className="max-w-40 truncate px-2 py-1.5 text-xs text-ink-2">{competitionLabel(competition, lang)}</td>
                  <td className="max-w-56 px-2 py-1.5">
                    <span className="mr-1.5 text-xs text-ink-3">{home ? "vs" : tr(lang, "at", "em")}</span>
                    {oppSlug ? (
                      <Link href={`/team/${oppSlug}/`} className="hover:underline">
                        {opponent}
                      </Link>
                    ) : (
                      opponent
                    )}
                  </td>
                  <td className="px-2 py-1.5 text-center">
                    <span className="font-semibold">
                      {gf}–{ga}
                    </span>{" "}
                    <span className={`text-xs ${res === "W" ? "text-good-ink" : res === "L" ? "text-bad-ink" : "text-ink-3"}`}>
                      {lang === "pt" ? { W: "V", D: "E", L: "D" }[res] : res}
                    </span>
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs">
                    {matchId && (
                      <Link href={`/match/${matchId}/`} className="text-accent hover:underline">
                        <T en="forecast" pt="previsão" />
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
