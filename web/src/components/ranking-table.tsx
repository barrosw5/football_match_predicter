"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { num } from "@/lib/format";
import { competitionLabel, countryName, formatDate, T, tr } from "@/lib/i18n";
import { teamSlug } from "@/lib/slug";
import type { RankingClub } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { TeamLogo } from "./team-logo";

const PAGE = 50;

/** Places gained / lost, as an icon + number (colour is never the only cue). */
export function Movement({ change, lang }: { change: number | null; lang: "en" | "pt" }) {
  if (change === null)
    return <span className="text-[11px] text-ink-3">{tr(lang, "new", "novo")}</span>;
  if (change === 0)
    return (
      <span className="inline-flex items-center gap-1 text-xs text-ink-3" aria-label={tr(lang, "no change", "sem alteração")}>
        <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
          <rect x="0" y="3" width="8" height="2" rx="1" fill="currentColor" />
        </svg>
      </span>
    );
  const up = change > 0;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${up ? "text-good-ink" : "text-bad-ink"}`}
      aria-label={up ? tr(lang, `up ${change}`, `subiu ${change}`) : tr(lang, `down ${-change}`, `desceu ${-change}`)}
    >
      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
        {up ? <path d="M4 0.5 7.5 7H0.5z" fill="currentColor" /> : <path d="M4 7.5 0.5 1h7z" fill="currentColor" />}
      </svg>
      {Math.abs(change)}
    </span>
  );
}

function Sparkline({ values, color = "var(--home)" }: { values: number[]; color?: string }) {
  if (values.length < 2) return <span className="text-xs text-ink-3">–</span>;
  const w = 64;
  const h = 18;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * (w - 4) + 2},${h - 2 - ((v - min) / span) * (h - 4)}`);
  const last = pts[pts.length - 1].split(",");
  return (
    <svg width={w} height={h} aria-hidden="true" className="overflow-visible">
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={last[0]} cy={last[1]} r="2.5" fill={color} stroke="var(--surface)" strokeWidth="1.5" />
    </svg>
  );
}

function money(v: number | null): string {
  if (v === null) return "–";
  return v >= 1000 ? `${num(v / 1000, 2)} B€` : `${Math.round(v)} M€`;
}

export function RankingTable({ clubs, valueDate }: { clubs: RankingClub[]; valueDate: string | null }) {
  const lang = useLang();
  const [period, setPeriod] = useState<7 | 30>(7);
  const [country, setCountry] = useState("");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);

  const countries = useMemo(
    () => [...new Set(clubs.map((c) => c.country).filter((c): c is string => !!c))].sort(),
    [clubs],
  );
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return clubs.filter((c) => (!country || c.country === country) && (!q || c.name.toLowerCase().includes(q)));
  }, [clubs, country, query]);
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div role="group" className="flex rounded-lg border border-line bg-surface p-0.5">
          {([7, 30] as const).map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={period === p}
              onClick={() => setPeriod(p)}
              className={`rounded-md px-3 py-1.5 text-sm ${period === p ? "bg-surface-2 font-medium" : "text-ink-2 hover:text-ink"}`}
            >
              {p === 7 ? tr(lang, "Last 7 days", "Últimos 7 dias") : tr(lang, "Last 30 days", "Últimos 30 dias")}
            </button>
          ))}
        </div>
        <select
          aria-label={tr(lang, "Country", "País")}
          value={country}
          onChange={(e) => {
            setCountry(e.target.value);
            setPage(0);
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          <option value="">{tr(lang, "Every country", "Todos os países")}</option>
          {countries.map((c) => (
            <option key={c} value={c}>
              {countryName(c, lang)}
            </option>
          ))}
        </select>
        <input
          type="search"
          aria-label={tr(lang, "Search a club", "Procurar clube")}
          placeholder={tr(lang, "Search a club", "Procurar clube")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3 sm:max-w-56"
        />
        <span className="tnum ml-auto text-sm text-ink-3">
          {rows.length} {tr(lang, "clubs", "clubes")}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface lg:overflow-visible">
        <table className="tnum w-full min-w-[52rem] text-sm">
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-surface [&_th]:shadow-[inset_0_-1px_0_var(--line)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
            <tr className="text-left text-xs text-ink-3">
              <th className="w-14 px-4 py-2.5 text-right font-normal">#</th>
              <th className="w-16 px-2 py-2.5 font-normal">
                <T en="Move" pt="Mudança" />
              </th>
              <th className="px-2 py-2.5 font-normal">
                <T en="Club" pt="Clube" />
              </th>
              <th className="px-2 py-2.5 text-right font-normal">Elo</th>
              <th className="px-2 py-2.5 text-right font-normal">
                <T en="Elo, 30 days" pt="Elo, 30 dias" />
              </th>
              <th className="px-2 py-2.5 font-normal">
                <T en="Last 10 matches" pt="Últimos 10 jogos" />
              </th>
              <th className="px-4 py-2.5 text-right font-normal">
                <T en="Squad value" pt="Valor do plantel" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {shown.map((c) => (
              <tr key={c.key} className="hover:bg-surface-2">
                <td className="px-4 py-2 text-right font-semibold">{c.rank}</td>
                <td className="px-2 py-2">
                  <Movement change={period === 7 ? c.change7 : c.change30} lang={lang} />
                </td>
                <td className="max-w-72 px-2 py-2">
                  <span className="flex min-w-0 items-center gap-2">
                    <TeamLogo id={c.logo} name={c.name} size={20} />
                    <span className="min-w-0">
                      <Link href={`/team/${teamSlug(c.key)}/`} className="block truncate font-medium hover:underline">
                        {c.name}
                      </Link>
                      <span className="block truncate text-xs text-ink-3">
                        {c.league ? competitionLabel(c.league, lang) : tr(lang, "UEFA only", "Só UEFA")}
                        {c.country ? ` · ${countryName(c.country, lang)}` : ""}
                      </span>
                    </span>
                  </span>
                </td>
                <td className="px-2 py-2 text-right font-semibold">{Math.round(c.elo)}</td>
                <td
                  className={`px-2 py-2 text-right ${
                    c.elo30 === null ? "text-ink-3" : c.elo30 > 0 ? "text-good-ink" : c.elo30 < 0 ? "text-bad-ink" : "text-ink-2"
                  }`}
                >
                  {c.elo30 === null ? "–" : `${c.elo30 > 0 ? "+" : c.elo30 < 0 ? "−" : ""}${Math.abs(Math.round(c.elo30))}`}
                </td>
                <td className="px-2 py-2">
                  <span title={c.history.map((v) => Math.round(v)).join(" · ")}>
                    <Sparkline values={c.history} />
                  </span>
                </td>
                <td className="px-4 py-2 text-right">
                  <span className="font-medium">{money(c.value)}</span>
                  {c.valueChange12m !== null && (
                    <span className={`block text-[11px] ${c.valueChange12m >= 0 ? "text-good-ink" : "text-bad-ink"}`}>
                      {c.valueChange12m >= 0 ? "+" : "−"}
                      {Math.abs(Math.round(c.valueChange12m))} M€ {tr(lang, "in 12 months", "em 12 meses")}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {tr(
          lang,
          "Movement = places gained or lost in the ranking over the selected period. Squad value: sum of the players' Transfermarkt market values",
          "Mudança = lugares ganhos ou perdidos no ranking no período escolhido. Valor do plantel: soma dos valores de mercado dos jogadores no Transfermarkt",
        )}
        {valueDate ? ` (${formatDate(`${valueDate}T12:00:00Z`, "dayMonth", lang)} ${valueDate.slice(0, 4)}).` : "."}
      </p>

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
