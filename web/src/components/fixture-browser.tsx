"use client";

import { useMemo, useState } from "react";

import { dateKey } from "@/lib/format";
import { LocalDate, T, tr } from "@/lib/i18n";
import type { Fixture } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { CompetitionPicker } from "./competition-picker";
import { FixtureRow } from "./fixture-row";
import { OutcomeLegend } from "./probability-bar";

type Group = { id: string; en: string; pt: string; codes: string[] | null };

const GROUPS: Group[] = [
  { id: "all", en: "All", pt: "Todos", codes: null },
  { id: "uefa", en: "UEFA", pt: "UEFA", codes: ["CL", "EL", "ECL"] },
  { id: "top5", en: "Big five", pt: "Top 5", codes: ["E0", "SP1", "D1", "I1", "F1"] },
  { id: "cups", en: "Cups", pt: "Taças", codes: ["PTC", "FAC", "EFLC", "CDR", "DFBP", "CI", "CDF", "KNVB", "SCC", "SLC"] },
  { id: "pt", en: "Portugal", pt: "Portugal", codes: ["P1", "PTC"] },
];

const WEEK_MS = 7 * 864e5;

export function FixtureBrowser({ fixtures, generatedAt }: { fixtures: Fixture[]; generatedAt: string }) {
  const lang = useLang();
  const [group, setGroup] = useState("all");
  const [competition, setCompetition] = useState("");
  const [query, setQuery] = useState("");
  // Only the first day is rendered at first: the others are built when opened.
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const inWeek = useMemo(() => {
    const limit = Date.parse(generatedAt) + WEEK_MS;
    return fixtures.filter((f) => Date.parse(f.kickoff) <= limit);
  }, [fixtures, generatedAt]);

  const competitions = useMemo(() => {
    const seen = new Map<string, Fixture["competition"]>();
    inWeek.forEach((f) => seen.set(f.competition.code, f.competition));
    return [...seen.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [inWeek]);

  const visible = useMemo(() => {
    const codes = GROUPS.find((g) => g.id === group)?.codes;
    const q = query.trim().toLowerCase();
    return inWeek.filter(
      (f) =>
        (!codes || codes.includes(f.competition.code)) &&
        (!competition || f.competition.code === competition) &&
        (!q || f.home.name.toLowerCase().includes(q) || f.away.name.toLowerCase().includes(q)),
    );
  }, [inWeek, group, competition, query]);

  const days = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    for (const f of visible) {
      const key = dateKey(f.kickoff);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()];
  }, [visible]);

  const filtering = !!query.trim() || !!competition || group !== "all";
  const isOpen = (key: string, index: number) => open[key] ?? (filtering || index === 0);

  return (
    <section aria-label={tr(lang, "Upcoming fixtures", "Próximos jogos")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" className="flex flex-wrap rounded-lg border border-line bg-surface p-0.5">
          {GROUPS.map((g) => (
            <button
              key={g.id}
              type="button"
              aria-pressed={group === g.id && !competition}
              onClick={() => {
                setGroup(g.id);
                setCompetition("");
              }}
              className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
                group === g.id && !competition ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
              }`}
            >
              <T en={g.en} pt={g.pt} />
            </button>
          ))}
        </div>
        <CompetitionPicker
          competitions={competitions}
          value={competition}
          onChange={(c) => {
            setCompetition(c);
            setGroup("all");
          }}
        />
        <input
          type="search"
          aria-label={tr(lang, "Search a team", "Procurar equipa")}
          placeholder={tr(lang, "Search a team", "Procurar equipa")}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 text-sm placeholder:text-ink-3 sm:max-w-56"
        />
        <span className="tnum ml-auto text-sm text-ink-3">
          {visible.length} <T en="matches" pt="jogos" />
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center justify-between gap-x-6 gap-y-1.5">
        <OutcomeLegend />
        <p className="flex items-center gap-1.5 text-xs text-ink-2">
          <span
            aria-hidden="true"
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] bg-[var(--good)] text-[9px] font-semibold text-white"
          >
            <T en="W" pt="V" />
          </span>
          <T
            en="Form: last 5 matches, latest on the right (filled). Hover a letter to see the match."
            pt="Forma: últimos 5 jogos, o mais recente à direita (preenchido). Passa o rato numa letra para ver o jogo."
          />
        </p>
      </div>

      {days.length === 0 && (
        <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-ink-2">
          <T en="No fixtures match these filters." pt="Nenhum jogo corresponde a estes filtros." />
        </p>
      )}

      <div className="space-y-3">
        {days.map(([key, list], index) => {
          const expanded = isOpen(key, index);
          return (
            <div key={key}>
              <button
                type="button"
                aria-expanded={expanded}
                onClick={() => setOpen((o) => ({ ...o, [key]: !expanded }))}
                className="flex w-full items-center gap-2 rounded-lg px-1 py-1.5 text-left text-sm font-medium text-ink-2 hover:text-ink"
              >
                <svg
                  width="12"
                  height="12"
                  viewBox="0 0 12 12"
                  aria-hidden="true"
                  className={`shrink-0 transition-transform ${expanded ? "rotate-90" : ""}`}
                >
                  <path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <LocalDate iso={list[0].kickoff} kind="day" />
                <span className="tnum ml-auto text-xs font-normal text-ink-3">
                  {list.length} <T en="matches" pt="jogos" />
                </span>
              </button>
              {expanded && (
                // no overflow-hidden: the form tooltips must be able to overlap the row above
                <ul className="mt-1 divide-y divide-line rounded-xl border border-line bg-surface">
                  {list.map((f) => (
                    <FixtureRow key={f.id} fixture={f} />
                  ))}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
