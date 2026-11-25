"use client";

import { useState } from "react";

import { num, pct } from "@/lib/format";
import { competitionLabel, formatDate, T, tr } from "@/lib/i18n";
import type { FormGame, MatchStats as Stats } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { RESULT_PT } from "./form-pills";
import { TeamLogo } from "./team-logo";

type Side = { name: string; logo?: string | null; games: FormGame[] };

const HOME = "var(--home)";
const AWAY = "var(--away)";

/** Average of a per-match value over the matches where the source recorded it. */
function avg(games: FormGame[], pick: (g: FormGame) => number | null | undefined) {
  const values = games.map(pick).filter((v): v is number => v !== null && v !== undefined);
  return { value: values.length ? values.reduce((a, b) => a + b, 0) / values.length : null, n: values.length };
}

function rate(games: FormGame[], test: (g: FormGame) => boolean) {
  return { value: games.length ? games.filter(test).length / games.length : null, n: games.length };
}

const stat = (key: keyof Stats) => (g: FormGame) => g.stats?.[key] ?? null;

type Metric = {
  en: string;
  pt: string;
  calc: (games: FormGame[]) => { value: number | null; n: number };
  format: (v: number) => string;
};

const METRICS: Metric[] = [
  { en: "Points per game", pt: "Pontos por jogo", calc: (g) => avg(g, (x) => (x.result === "W" ? 3 : x.result === "D" ? 1 : 0)), format: (v) => num(v, 2) },
  { en: "Goals scored", pt: "Golos marcados", calc: (g) => avg(g, (x) => x.goalsFor), format: (v) => num(v, 2) },
  { en: "Goals conceded", pt: "Golos sofridos", calc: (g) => avg(g, (x) => x.goalsAgainst), format: (v) => num(v, 2) },
  { en: "xG for", pt: "xG a favor", calc: (g) => avg(g, stat("xgFor")), format: (v) => num(v, 2) },
  { en: "xG against", pt: "xG contra", calc: (g) => avg(g, stat("xgAgainst")), format: (v) => num(v, 2) },
  { en: "Shots", pt: "Remates", calc: (g) => avg(g, stat("shotsFor")), format: (v) => num(v, 1) },
  { en: "Shots on target", pt: "Remates à baliza", calc: (g) => avg(g, stat("sotFor")), format: (v) => num(v, 1) },
  { en: "Shots conceded", pt: "Remates sofridos", calc: (g) => avg(g, stat("shotsAgainst")), format: (v) => num(v, 1) },
  { en: "Corners", pt: "Cantos", calc: (g) => avg(g, stat("cornersFor")), format: (v) => num(v, 1) },
  { en: "Yellow cards", pt: "Cartões amarelos", calc: (g) => avg(g, stat("yellow")), format: (v) => num(v, 1) },
  { en: "Red cards", pt: "Cartões vermelhos", calc: (g) => avg(g, stat("red")), format: (v) => num(v, 2) },
  { en: "Clean sheets", pt: "Jogos sem sofrer", calc: (g) => rate(g, (x) => x.goalsAgainst === 0), format: (v) => pct(v) },
  { en: "Both teams scored", pt: "Ambas marcaram", calc: (g) => rate(g, (x) => x.goalsFor > 0 && x.goalsAgainst > 0), format: (v) => pct(v) },
  { en: "Over 2.5 goals", pt: "Mais de 2,5 golos", calc: (g) => rate(g, (x) => x.goalsFor + x.goalsAgainst > 2), format: (v) => pct(v) },
];

export function MatchStats({
  home,
  away,
  expected,
}: {
  home: Side;
  away: Side;
  expected: { xgHome: number; xgAway: number; btts: number; over25: number };
}) {
  const lang = useLang();
  const [count, setCount] = useState<5 | 10>(5);
  const [view, setView] = useState<"home" | "away">("home");
  const homeGames = home.games.slice(-count);
  const awayGames = away.games.slice(-count);
  const hasDetail = [...homeGames, ...awayGames].some((g) => g.stats?.shotsFor != null);

  return (
    <div>
      {/* Expected for this match */}
      <dl className="tnum grid grid-cols-3 gap-2 text-sm sm:gap-3">
        <Expected label={<T en="Expected goals" pt="Golos esperados" />} value={`${num(expected.xgHome, 2)} – ${num(expected.xgAway, 2)}`} />
        <Expected label={<T en="Both teams score" pt="Ambas marcam" />} value={pct(expected.btts)} />
        <Expected label={<T en="Over 2.5 goals" pt="Mais de 2,5 golos" />} value={pct(expected.over25)} />
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          <T en="Recent averages" pt="Médias recentes" />
        </h3>
        <Toggle
          options={[
            { id: 5, label: tr(lang, "Last 5", "Últimos 5") },
            { id: 10, label: tr(lang, "Last 10", "Últimos 10") },
          ]}
          value={count}
          onChange={(v) => setCount(v as 5 | 10)}
        />
      </div>

      <table className="tnum mt-3 w-full table-fixed text-sm">
        <colgroup>
          <col className="w-12 sm:w-[4.5rem]" />
          <col />
          <col className="w-[7.5rem] sm:w-[11rem]" />
          <col />
          <col className="w-12 sm:w-[4.5rem]" />
        </colgroup>
        <thead>
          <tr className="text-xs text-ink-3">
            <th colSpan={2} className="pb-2 text-left font-normal">
              <span className="flex items-center gap-1.5">
                <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: HOME }} aria-hidden="true" />
                <span className="truncate">{home.name}</span>
              </span>
            </th>
            <th />
            <th colSpan={2} className="pb-2 text-right font-normal">
              <span className="flex items-center justify-end gap-1.5">
                <span className="truncate">{away.name}</span>
                <span className="inline-block h-2 w-2 shrink-0 rounded-[2px]" style={{ background: AWAY }} aria-hidden="true" />
              </span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {METRICS.map((m) => {
            const h = m.calc(homeGames);
            const a = m.calc(awayGames);
            const max = Math.max(h.value ?? 0, a.value ?? 0) || 1;
            return (
              <tr key={m.en}>
                <td className="py-1.5 font-medium">{h.value === null ? "–" : m.format(h.value)}</td>
                <td className="py-1.5">
                  <span className="flex justify-end">
                    <span className="grow-x-end h-2 rounded-l-[4px]" style={{ width: `${((h.value ?? 0) / max) * 100}%`, background: HOME }} />
                  </span>
                </td>
                <td className="px-1.5 py-1.5 text-center text-xs leading-4 text-ink-2 sm:px-2">
                  <T en={m.en} pt={m.pt} />
                </td>
                <td className="py-1.5">
                  <span className="flex">
                    <span className="grow-x h-2 rounded-r-[4px]" style={{ width: `${((a.value ?? 0) / max) * 100}%`, background: AWAY }} />
                  </span>
                </td>
                <td className="py-1.5 text-right font-medium">{a.value === null ? "–" : m.format(a.value)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">
        <T
          en="Averages per match. xG exists from 2026/27; shots, corners and cards only for the main leagues, so those use the matches where they were recorded."
          pt="Médias por jogo. O xG existe desde 2026/27; remates, cantos e cartões só nas ligas principais, por isso usam apenas os jogos onde foram registados."
        />
      </p>

      {/* Match by match */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-medium">
          <T en="Match by match" pt="Jogo a jogo" />
        </h3>
        <Toggle
          options={[
            { id: "home", label: home.name },
            { id: "away", label: away.name },
          ]}
          value={view}
          onChange={(v) => setView(v as "home" | "away")}
        />
      </div>
      <History games={(view === "home" ? home : away).games.slice(-count)} lang={lang} showDetail={hasDetail} />
    </div>
  );
}

function Expected({ label, value }: { label: React.ReactNode; value: string }) {
  return (
    <div className="min-w-0 rounded-lg bg-surface-2 px-2.5 py-2 sm:px-3">
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 whitespace-nowrap font-semibold">{value}</dd>
    </div>
  );
}

function Toggle<V extends string | number>({
  options,
  value,
  onChange,
}: {
  options: { id: V; label: string }[];
  value: V;
  onChange: (v: V) => void;
}) {
  return (
    <div role="group" className="flex max-w-full rounded-lg border border-line p-0.5 text-xs">
      {options.map((o) => (
        <button
          key={String(o.id)}
          type="button"
          aria-pressed={o.id === value}
          onClick={() => onChange(o.id)}
          className={`max-w-40 truncate rounded-md px-2.5 py-1 ${o.id === value ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

const pair = (a: number | null | undefined, b: number | null | undefined, digits = 0) =>
  a == null || b == null ? "–" : `${num(a, digits)}–${num(b, digits)}`;

function History({ games, lang, showDetail }: { games: FormGame[]; lang: "en" | "pt"; showDetail: boolean }) {
  const list = [...games].reverse();
  if (list.length === 0)
    return (
      <p className="mt-3 text-sm text-ink-3">
        <T en="No previous matches in the data." pt="Sem jogos anteriores nos dados." />
      </p>
    );
  return (
    <div className="scroll-x mt-3">
      <table className={`tnum w-full text-sm ${showDetail ? "min-w-[38rem]" : "min-w-[22rem]"}`}>
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="pb-2 font-normal">{tr(lang, "Date", "Data")}</th>
            <th className="pb-2 font-normal">{tr(lang, "Opponent", "Adversário")}</th>
            <th className="pb-2 text-center font-normal">{tr(lang, "Score", "Resultado")}</th>
            <th className="pb-2 text-center font-normal">xG</th>
            {showDetail && (
              <>
                <th className="pb-2 text-center font-normal">{tr(lang, "Shots (on target)", "Remates (à baliza)")}</th>
                <th className="pb-2 text-center font-normal">{tr(lang, "Corners", "Cantos")}</th>
                <th className="pb-2 text-center font-normal">{tr(lang, "Yellow", "Amarelos")}</th>
                <th className="pb-2 text-center font-normal">{tr(lang, "Red", "Vermelhos")}</th>
              </>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {list.map((g, i) => {
            const s = g.stats;
            return (
              <tr key={`${g.date}-${i}`}>
                <td className="py-1.5 pr-2 text-xs text-ink-2">
                  {formatDate(`${g.date}T12:00:00Z`, "dayMonth", lang)}
                  <span className="block text-[10px] text-ink-3">{competitionLabel(g.competition, lang)}</span>
                </td>
                <td className="max-w-44 py-1.5 pr-2">
                  <span className="flex min-w-0 items-center gap-1.5">
                    <span className="shrink-0 text-xs text-ink-3">{g.home ? tr(lang, "vs", "vs") : tr(lang, "at", "em")}</span>
                    <TeamLogo id={g.opponentLogo} name={g.opponent} size={16} />
                    <span className="truncate">{g.opponent}</span>
                  </span>
                </td>
                <td className="py-1.5 text-center">
                  <span className="font-semibold">
                    {g.goalsFor}–{g.goalsAgainst}
                  </span>{" "}
                  <span className="text-xs text-ink-3">{lang === "pt" ? RESULT_PT[g.result] : g.result}</span>
                </td>
                <td className="py-1.5 text-center text-ink-2">{pair(s?.xgFor, s?.xgAgainst, 1)}</td>
                {showDetail && (
                  <>
                    <td className="py-1.5 text-center text-ink-2">
                      {s?.shotsFor == null ? "–" : `${s.shotsFor}–${s.shotsAgainst ?? "–"} (${s.sotFor ?? "–"}–${s.sotAgainst ?? "–"})`}
                    </td>
                    <td className="py-1.5 text-center text-ink-2">{pair(s?.cornersFor, s?.cornersAgainst)}</td>
                    <td className="py-1.5 text-center text-ink-2">{s?.yellow ?? "–"}</td>
                    <td className={`py-1.5 text-center ${s?.red ? "font-semibold text-bad-ink" : "text-ink-2"}`}>{s?.red ?? "–"}</td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-ink-3">
        <T en="Values from this team's side: for–against." pt="Valores do ponto de vista desta equipa: a favor–contra." />
      </p>
    </div>
  );
}
