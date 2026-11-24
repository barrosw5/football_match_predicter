"use client";

import { useMemo, useState } from "react";

import { dateKey } from "@/lib/format";
import { competitionName, countryName, LocalDate, T, tr } from "@/lib/i18n";
import type { Fixture } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { FixtureRow } from "./fixture-row";
import { OutcomeLegend } from "./probability-bar";

type Group = { id: string; en: string; pt: string; codes: string[] | null };

const GROUPS: Group[] = [
  { id: "all", en: "All", pt: "Todos", codes: null },
  { id: "uefa", en: "UEFA", pt: "UEFA", codes: ["CL", "EL", "ECL"] },
  { id: "top5", en: "Big five", pt: "Top 5", codes: ["E0", "SP1", "D1", "I1", "F1"] },
  { id: "pt", en: "Portugal", pt: "Portugal", codes: ["P1"] },
];

export function FixtureBrowser({ fixtures }: { fixtures: Fixture[] }) {
  const lang = useLang();
  const [group, setGroup] = useState("all");
  const [competition, setCompetition] = useState("");
  const [query, setQuery] = useState("");

  const competitions = useMemo(() => {
    const seen = new Map<string, Fixture["competition"]>();
    fixtures.forEach((f) => seen.set(f.competition.code, f.competition));
    return [...seen.values()].sort((a, b) => a.country.localeCompare(b.country) || a.name.localeCompare(b.name));
  }, [fixtures]);

  const visible = useMemo(() => {
    const codes = GROUPS.find((g) => g.id === group)?.codes;
    const q = query.trim().toLowerCase();
    return fixtures.filter(
      (f) =>
        (!codes || codes.includes(f.competition.code)) &&
        (!competition || f.competition.code === competition) &&
        (!q || f.home.name.toLowerCase().includes(q) || f.away.name.toLowerCase().includes(q)),
    );
  }, [fixtures, group, competition, query]);

  const days = useMemo(() => {
    const map = new Map<string, Fixture[]>();
    for (const f of visible) {
      const key = dateKey(f.kickoff);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(f);
    }
    return [...map.entries()];
  }, [visible]);

  return (
    <section aria-label={tr(lang, "Upcoming fixtures", "Próximos jogos")}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div role="group" className="flex rounded-lg border border-line bg-surface p-0.5">
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
        <select
          aria-label={tr(lang, "Competition", "Competição")}
          value={competition}
          onChange={(e) => {
            setCompetition(e.target.value);
            setGroup("all");
          }}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        >
          <option value="">{tr(lang, "Every competition", "Todas as competições")}</option>
          {competitions.map((c) => (
            <option key={c.code} value={c.code}>
              {countryName(c.country, lang)} · {competitionName(c.code, c.name, lang)}
            </option>
          ))}
        </select>
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

      <div className="mb-3">
        <OutcomeLegend />
      </div>

      {days.length === 0 && (
        <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-ink-2">
          <T en="No fixtures match these filters." pt="Nenhum jogo corresponde a estes filtros." />
        </p>
      )}

      <div className="space-y-6">
        {days.map(([key, list]) => (
          <div key={key}>
            <h2 className="mb-2 flex items-baseline justify-between text-sm font-medium text-ink-2">
              <LocalDate iso={list[0].kickoff} kind="day" />
              <span className="tnum text-xs text-ink-3">{list.length}</span>
            </h2>
            <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line bg-surface">
              {list.map((f) => (
                <FixtureRow key={f.id} fixture={f} />
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}
