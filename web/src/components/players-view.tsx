"use client";

import Link from "next/link";
import { useState } from "react";

import { competitionLabel, countryName, T, tr } from "@/lib/i18n";
import type { Leader, PlayersData } from "@/lib/types";
import { useLang } from "@/lib/use-lang";

import { TeamLogo } from "./team-logo";

type Competition = { code: string; country: string };

export function PlayersView({ data, competitions }: { data: PlayersData; competitions: Competition[] }) {
  const lang = useLang();
  const available = competitions.filter((c) => data.competitions[c.code]);
  const [code, setCode] = useState(available.find((c) => c.code === "P1")?.code ?? available[0]?.code ?? "");
  const comp = data.competitions[code];

  if (!comp)
    return (
      <p className="text-ink-2">
        <T en="No player statistics yet." pt="Ainda não há estatísticas de jogadores." />
      </p>
    );

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <select
          aria-label={tr(lang, "Competition", "Competição")}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          className="rounded-lg border border-line bg-surface px-3 py-2 text-sm"
        >
          {available.map((c) => (
            <option key={c.code} value={c.code}>
              {countryName(c.country, lang)} · {competitionLabel(c.code, lang)}
            </option>
          ))}
        </select>
        {comp.season && <span className="text-sm text-ink-3">{comp.season}</span>}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <LeaderTable title={<T en="Top scorers" pt="Melhores marcadores" />} unit={tr(lang, "Goals", "Golos")} rows={comp.goals} lang={lang} />
        <LeaderTable title={<T en="Most assists" pt="Mais assistências" />} unit={tr(lang, "Assists", "Assist.")} rows={comp.assists} lang={lang} />
      </div>
      <p className="mt-3 text-xs text-ink-3">
        <T
          en="Source: ESPN, current season, all matches of the competition."
          pt="Fonte: ESPN, época atual, todos os jogos da competição."
        />
      </p>
    </div>
  );
}

function LeaderTable({
  title,
  unit,
  rows,
  lang,
}: {
  title: React.ReactNode;
  unit: string;
  rows: Leader[];
  lang: "en" | "pt";
}) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold">{title}</h2>
      <table className="tnum mt-3 w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-ink-3">
            <th className="w-8 pb-2 font-normal">#</th>
            <th className="pb-2 font-normal">{tr(lang, "Player", "Jogador")}</th>
            <th className="pb-2 text-right font-normal">{tr(lang, "Matches", "Jogos")}</th>
            <th className="pb-2 text-right font-normal">{unit}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {rows.map((r, i) => {
            const rank = i > 0 && rows[i - 1].value === r.value ? "" : i + 1;
            return (
              <tr key={`${r.name}-${i}`}>
                <td className="py-1.5 text-ink-3">{rank}</td>
                <td className="max-w-56 py-1.5">
                  {r.id ? (
                    <Link href={`/player/?id=${r.id}`} className="block truncate font-medium hover:underline">
                      {r.name}
                    </Link>
                  ) : (
                    <span className="block truncate font-medium">{r.name}</span>
                  )}
                  <span className="flex items-center gap-1.5 text-xs text-ink-3">
                    <TeamLogo id={r.teamLogo} name={r.team} size={14} />
                    <span className="truncate">{r.team}</span>
                  </span>
                </td>
                <td className="py-1.5 text-right text-ink-2">{r.matches ?? "–"}</td>
                <td className="py-1.5 text-right font-semibold">{r.value}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
