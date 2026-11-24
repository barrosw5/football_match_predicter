"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { tr } from "@/lib/i18n";
import type { PlayersTable as Data, TableRow } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { CompetitionPicker, type PickerCompetition } from "./competition-picker";
import { TeamLogo } from "./team-logo";

const BASE = process.env.NEXT_PUBLIC_BASE_PATH || "";
const PAGE = 50;

type Key = keyof Pick<
  TableRow,
  "value" | "apps" | "starts" | "goals" | "assists" | "shots" | "sot" | "fouls" | "fouled" | "yellow" | "red"
>;

const COLUMNS: { key: Key; en: string; pt: string; title?: [string, string] }[] = [
  { key: "value", en: "Value", pt: "Valor", title: ["Transfermarkt market value", "Valor de mercado (Transfermarkt)"] },
  { key: "apps", en: "Apps", pt: "Jogos" },
  { key: "starts", en: "Starts", pt: "Titular" },
  { key: "goals", en: "Goals", pt: "Golos" },
  { key: "assists", en: "Assists", pt: "Assist." },
  { key: "shots", en: "Shots", pt: "Remates" },
  { key: "sot", en: "On target", pt: "À baliza" },
  { key: "fouls", en: "Fouls", pt: "Faltas", title: ["Fouls committed", "Faltas cometidas"] },
  { key: "fouled", en: "Fouled", pt: "Sofridas", title: ["Fouls suffered", "Faltas sofridas"] },
  { key: "yellow", en: "Yellow", pt: "Amarelos" },
  { key: "red", en: "Red", pt: "Vermelhos" },
];

const POSITIONS = [
  { id: "", en: "All", pt: "Todos" },
  { id: "G", en: "GK", pt: "GR" },
  { id: "D", en: "DEF", pt: "DEF" },
  { id: "M", en: "MID", pt: "MÉD" },
  { id: "F", en: "FWD", pt: "AV" },
];

function posGroup(pos: string | null): string {
  const base = (pos ?? "").split("-")[0].toUpperCase();
  if (base.startsWith("G")) return "G";
  if (["D", "CD", "LB", "RB", "LWB", "RWB", "SW", "CB"].includes(base)) return "D";
  if (["F", "CF", "ST", "LF", "RF"].includes(base)) return "F";
  return "M";
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

const money = (v: number | null) => (v === null ? "–" : v >= 1 ? `${v % 1 === 0 ? v : v.toFixed(1)} M€` : `${Math.round(v * 1000)} k€`);

export function PlayersTable({ competitions }: { competitions: PickerCompetition[] }) {
  const lang = useLang();
  const [data, setData] = useState<Data | null>(null);
  const [competition, setCompetition] = useState("P1");
  const [position, setPosition] = useState("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: Key; desc: boolean }>({ key: "goals", desc: true });
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch(`${BASE}/data/players-table.json`)
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData({ generatedAt: "", season: null, competitions: {} }));
  }, []);

  const available = useMemo(() => competitions.filter((c) => data?.competitions[c.code]?.length), [competitions, data]);

  const rows = useMemo(() => {
    if (!data) return [];
    let list: TableRow[];
    if (competition) list = data.competitions[competition] ?? [];
    else {
      // every competition: add up each player's rows
      const merged = new Map<string, TableRow>();
      for (const comp of Object.values(data.competitions))
        for (const r of comp) {
          const m = merged.get(r.id);
          if (!m) merged.set(r.id, { ...r });
          else
            for (const k of ["apps", "starts", "goals", "assists", "shots", "sot", "fouls", "fouled", "offsides", "yellow", "red", "saves"] as const)
              m[k] += r[k];
        }
      list = [...merged.values()];
    }
    const q = query.trim().toLowerCase();
    const filtered = list.filter(
      (r) => (!position || posGroup(r.pos) === position) && (!q || r.name.toLowerCase().includes(q) || r.team.toLowerCase().includes(q)),
    );
    const dir = sort.desc ? -1 : 1;
    return filtered.sort((a, b) => ((a[sort.key] ?? -1) - (b[sort.key] ?? -1)) * dir || b.goals - a.goals || a.name.localeCompare(b.name));
  }, [data, competition, position, query, sort]);

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const current = Math.min(page, pages - 1);
  const shown = rows.slice(current * PAGE, current * PAGE + PAGE);
  const sortBy = (key: Key) => {
    setSort((s) => (s.key === key ? { key, desc: !s.desc } : { key, desc: true }));
    setPage(0);
  };

  return (
    <div className={data ? "" : "opacity-60"}>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <CompetitionPicker
          competitions={available}
          value={competition}
          onChange={(c) => {
            setCompetition(c);
            setPage(0);
          }}
        />
        <div role="group" className="flex rounded-lg border border-line bg-surface p-0.5">
          {POSITIONS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={position === p.id}
              onClick={() => {
                setPosition(p.id);
                setPage(0);
              }}
              className={`rounded-md px-2.5 py-1.5 text-sm ${position === p.id ? "bg-surface-2 font-medium" : "text-ink-2 hover:text-ink"}`}
            >
              {lang === "pt" ? p.pt : p.en}
            </button>
          ))}
        </div>
        <input
          type="search"
          aria-label={tr(lang, "Search a player or team", "Procurar jogador ou equipa")}
          placeholder={tr(lang, "Search a player or team", "Procurar jogador ou equipa")}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setPage(0);
          }}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3 sm:max-w-64"
        />
        <span className="tnum ml-auto text-sm text-ink-3">
          {rows.length} {tr(lang, "players", "jogadores")}
          {data?.season ? ` · ${data.season}` : ""}
        </span>
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-surface lg:overflow-visible">
        <table className="tnum w-full min-w-[60rem] text-sm">
          <thead className="[&_th]:sticky [&_th]:top-0 [&_th]:z-10 [&_th]:bg-surface [&_th]:shadow-[inset_0_-1px_0_var(--line)] [&_th:first-child]:rounded-tl-xl [&_th:last-child]:rounded-tr-xl">
            <tr className="text-xs text-ink-3">
              <th className="w-12 px-3 py-2.5 text-right font-normal">#</th>
              <th className="px-2 py-2.5 text-left font-normal">{tr(lang, "Player", "Jogador")}</th>
              {COLUMNS.map((c) => {
                const active = sort.key === c.key;
                return (
                  <th key={c.key} className="px-1 py-2.5 text-right font-normal last:pr-4">
                    <button
                      type="button"
                      onClick={() => sortBy(c.key)}
                      title={c.title ? (lang === "pt" ? c.title[1] : c.title[0]) : undefined}
                      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 hover:text-ink ${active ? "font-medium text-ink" : ""}`}
                    >
                      {lang === "pt" ? c.pt : c.en}
                      <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true" className={active ? "" : "opacity-30"}>
                        {active && !sort.desc ? <path d="M4 1 7 6H1z" fill="currentColor" /> : <path d="M4 7 1 2h6z" fill="currentColor" />}
                      </svg>
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {!data && (
              <tr>
                <td colSpan={COLUMNS.length + 2} className="px-4 py-6 text-ink-3">
                  {tr(lang, "Loading…", "A carregar…")}
                </td>
              </tr>
            )}
            {shown.map((r, i) => (
              <tr key={r.id} className="hover:bg-surface-2">
                <td className="px-3 py-2 text-right text-ink-3">{current * PAGE + i + 1}</td>
                <td className="max-w-72 px-2 py-2">
                  <span className="flex min-w-0 items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-2 text-[11px] font-semibold text-ink-2">
                      {initials(r.name)}
                    </span>
                    <span className="min-w-0">
                      <Link href={`/player/?id=${r.id}`} className="block truncate font-medium hover:underline">
                        {r.name}
                      </Link>
                      <span className="flex items-center gap-1.5 text-xs text-ink-3">
                        <TeamLogo id={r.teamLogo} name={r.team} size={14} />
                        {r.teamSlug ? (
                          <Link href={`/team/${r.teamSlug}/`} className="truncate hover:underline">
                            {r.team}
                          </Link>
                        ) : (
                          <span className="truncate">{r.team}</span>
                        )}
                      </span>
                    </span>
                  </span>
                </td>
                {COLUMNS.map((c) => (
                  <td
                    key={c.key}
                    className={`px-2 py-2 text-right last:pr-4 ${sort.key === c.key ? "font-semibold text-ink" : "text-ink-2"}`}
                  >
                    {c.key === "value" ? money(r.value) : r[c.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-xs text-ink-3">
        {tr(
          lang,
          "Totals from the published line-ups of this season (main leagues, UEFA and Taça de Portugal). Market values: Transfermarkt open data. Photos, minutes, dribbles or pass accuracy are not available from free sources.",
          "Totais das escalações publicadas desta época (ligas principais, UEFA e Taça de Portugal). Valores de mercado: dados abertos do Transfermarkt. Fotos, minutos, dribles ou % de passe não existem em fontes gratuitas.",
        )}
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
