import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { Verdict } from "@/components/badges";
import { ProbabilityBar } from "@/components/probability-bar";
import { Movement } from "@/components/ranking-table";
import { TeamHistory } from "@/components/team-history";
import { EloChart, ValueChart } from "@/components/team-charts";
import { TeamLogo } from "@/components/team-logo";
import { getTeams } from "@/lib/data";
import { formatTime, pct } from "@/lib/format";
import { competitionLabel, countryName, LocalDate, T } from "@/lib/i18n";
import type { SquadPlayer } from "@/lib/types";

export const dynamicParams = false;

export function generateStaticParams() {
  const slugs = Object.keys(getTeams());
  // Static export needs at least one path even before the pipeline has produced data.
  return slugs.length ? slugs.map((slug) => ({ slug })) : [{ slug: "none" }];
}

export async function generateMetadata({ params }: PageProps<"/team/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const team = getTeams()[slug];
  return team ? { title: team.name, description: `${team.name}: Elo, forecasts, squad and full match history.` } : {};
}

const card = "rounded-2xl border border-line bg-surface p-5 sm:p-6";

const money = (v: number | null) => (v === null ? "–" : v >= 1000 ? `${(v / 1000).toFixed(2)} B€` : `${Math.round(v)} M€`);

const GROUPS: { en: string; pt: string; test: (p: SquadPlayer) => boolean }[] = [
  { en: "Goalkeepers", pt: "Guarda-redes", test: (p) => (p.pos ?? "").startsWith("G") },
  { en: "Defenders", pt: "Defesas", test: (p) => (p.pos ?? "").startsWith("D") },
  { en: "Midfielders", pt: "Médios", test: (p) => (p.pos ?? "").startsWith("M") },
  { en: "Forwards", pt: "Avançados", test: (p) => (p.pos ?? "").startsWith("F") },
];

export default async function TeamPage({ params }: PageProps<"/team/[slug]">) {
  const { slug } = await params;
  const team = getTeams()[slug];
  if (!team) notFound();
  const correct = team.record.filter((r) => r.correct).length;
  const grouped = GROUPS.map((g) => ({ ...g, players: team.squad.filter(g.test) }));
  const other = team.squad.filter((p) => !GROUPS.some((g) => g.test(p)));

  return (
    <article className="py-6">
      <Link href="/ranking/" className="text-sm text-ink-2 hover:text-ink">
        <T en="Back to the ranking" pt="Voltar ao ranking" />
      </Link>

      <header className={`mt-4 ${card} flex flex-wrap items-center gap-5`}>
        <TeamLogo id={team.logo} name={team.name} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{team.name}</h1>
          <p className="mt-1 text-sm text-ink-2">
            {team.league ? (
              <T en={competitionLabel(team.league, "en")} pt={competitionLabel(team.league, "pt")} />
            ) : (
              <T en="UEFA competitions" pt="Competições UEFA" />
            )}
            {team.country && (
              <>
                {" · "}
                <T en={countryName(team.country, "en")} pt={countryName(team.country, "pt")} />
              </>
            )}
          </p>
        </div>
        <dl className="tnum grid grid-cols-3 gap-4 text-sm sm:gap-8">
          <Stat
            label={<T en="Elo ranking" pt="Ranking Elo" />}
            value={`#${team.rank}`}
            detail={
              <span className="inline-flex items-center gap-1.5">
                {Math.round(team.elo)}
                <span className="i18n-en">
                  <Movement change={team.change30} lang="en" />
                </span>
                <span className="i18n-pt">
                  <Movement change={team.change30} lang="pt" />
                </span>
              </span>
            }
          />
          <Stat label={<T en="Squad value" pt="Valor do plantel" />} value={money(team.value)} detail={team.valueDate ? `Transfermarkt ${team.valueDate.slice(0, 7)}` : undefined} />
          <Stat
            label={<T en="Forecasts right" pt="Previsões certas" />}
            value={team.record.length ? pct(correct / team.record.length) : "–"}
            detail={<T en={`${correct} of ${team.record.length}`} pt={`${correct} de ${team.record.length}`} />}
          />
        </dl>
      </header>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <section className={card}>
          <h2 className="font-semibold">
            <T en="Elo over the last year" pt="Elo no último ano" />
          </h2>
          <div className="mt-3">
            <EloChart points={team.eloHistory} />
          </div>
        </section>
        <section className={card}>
          <h2 className="font-semibold">
            <T en="Squad value over time" pt="Valor do plantel ao longo do tempo" />
          </h2>
          <p className="mb-3 mt-1 text-xs text-ink-3">
            <T en="Sum of player market values, every 6 months (EUR millions)." pt="Soma dos valores de mercado dos jogadores, a cada 6 meses (milhões de euros)." />
          </p>
          <ValueChart history={team.valueHistory} />
        </section>
      </div>

      {team.upcoming.length > 0 && (
        <section className={`mt-4 ${card}`}>
          <h2 className="font-semibold">
            <T en="Next matches" pt="Próximos jogos" />
          </h2>
          <ul className="mt-3 divide-y divide-line">
            {team.upcoming.map((m) => (
              <li key={m.id}>
                <Link href={`/match/${m.id}/`} className="grid grid-cols-1 gap-2 py-3 hover:bg-surface-2 sm:grid-cols-[10rem_minmax(0,1fr)_minmax(0,1fr)] sm:items-center">
                  <span className="text-sm text-ink-2">
                    <LocalDate iso={m.kickoff} kind="short" /> · {formatTime(m.kickoff)}
                    <span className="block text-xs text-ink-3">
                      <T en={competitionLabel(m.competition, "en")} pt={competitionLabel(m.competition, "pt")} />
                    </span>
                  </span>
                  <span className="flex min-w-0 items-center gap-2 font-medium">
                    <span className="text-xs font-normal text-ink-3">{m.home ? "vs" : <T en="at" pt="em" />}</span>
                    <TeamLogo id={m.opponentLogo} name={m.opponent} size={20} />
                    <span className="truncate">{m.opponent}</span>
                  </span>
                  <span>
                    <ProbabilityBar
                      probs={{ home: m.win, draw: m.draw, away: m.loss }}
                      labels={[<T key="w" en="Win" pt="Vitória" />, <T key="d" en="Draw" pt="Empate" />, <T key="l" en="Loss" pt="Derrota" />]}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-ink-3">
            <T en="Bars from this team's point of view: win, draw, loss." pt="Barras do ponto de vista desta equipa: vitória, empate, derrota." />
          </p>
        </section>
      )}

      {team.record.length > 0 && (
        <section className={`mt-4 ${card}`}>
          <h2 className="font-semibold">
            <T en="Recent forecasts" pt="Previsões recentes" />
          </h2>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 sm:grid-cols-2">
            {team.record.slice(0, 12).map((r, i) => {
              const pickText =
                r.pick === "D" ? { en: "draw", pt: "empate" } : (r.pick === "H") === r.home ? { en: "win", pt: "vitória" } : { en: "loss", pt: "derrota" };
              const row = (
                <span className="flex items-center gap-3 border-b border-line py-2 text-sm">
                  <span className="w-16 shrink-0 text-xs text-ink-3">
                    <LocalDate iso={`${r.date}T12:00:00Z`} kind="dayMonth" />
                  </span>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5">
                    <span className="shrink-0">{r.home ? "vs" : <T en="at" pt="em" />}</span>
                    <TeamLogo id={r.opponentLogo} name={r.opponent} size={16} />
                    <span className="truncate">{r.opponent}</span>
                    <span className="tnum shrink-0 font-semibold">
                      {r.goalsFor}–{r.goalsAgainst}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-ink-2">
                    <T en={`pick: ${pickText.en}`} pt={`previsão: ${pickText.pt}`} />
                  </span>
                  <Verdict correct={r.correct} />
                </span>
              );
              return (
                <li key={`${r.date}-${i}`}>
                  {r.id ? (
                    <Link href={`/match/${r.id}/`} className="block hover:bg-surface-2">
                      {row}
                    </Link>
                  ) : (
                    row
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className={`mt-4 ${card}`}>
        <h2 className="font-semibold">
          <T en="Squad" pt="Plantel" />
        </h2>
        {team.squad.length === 0 ? (
          <p className="mt-2 text-sm text-ink-3">
            <T en="Squad not available." pt="Plantel não disponível." />
          </p>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-x-8 gap-y-4 md:grid-cols-2">
            {[...grouped, { en: "Others", pt: "Outros", players: other }]
              .filter((g) => g.players.length > 0)
              .map((g) => (
                <div key={g.en}>
                  <h3 className="mb-1 text-xs font-medium text-ink-3">
                    <T en={g.en} pt={g.pt} />
                  </h3>
                  <SquadList players={g.players} />
                </div>
              ))}
          </div>
        )}
        <p className="mt-3 text-xs text-ink-3">
          <T
            en="Current squad from ESPN. Goals and assists: this season, all covered competitions; appearances: matches with published line-ups."
            pt="Plantel atual (ESPN). Golos e assistências: esta época, em todas as competições cobertas; jogos: partidas com escalação publicada."
          />
        </p>
      </section>

      <section className={`mt-4 ${card}`}>
        <h2 className="mb-3 font-semibold">
          <T en="Every match" pt="Todos os jogos" />
        </h2>
        <TeamHistory rows={team.history} />
      </section>
    </article>
  );
}

function Stat({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 text-xl font-semibold">{value}</dd>
      {detail && <dd className="text-xs text-ink-2">{detail}</dd>}
    </div>
  );
}

function SquadList({ players }: { players: SquadPlayer[] }) {
  return (
    <ul className="divide-y divide-line">
      {players.map((p) => (
        <li key={p.id}>
          <Link href={`/player/?id=${p.id}`} className="tnum flex items-center gap-3 py-1.5 text-sm hover:bg-surface-2">
            <span className="tnum w-6 shrink-0 text-right text-xs text-ink-3">{p.jersey ?? "–"}</span>
            <span className="min-w-0 flex-1 truncate">{p.name}</span>
            <span className="hidden shrink-0 text-xs text-ink-3 sm:inline">{p.nationality ?? ""}</span>
            <span className="w-10 shrink-0 text-right text-xs text-ink-2">{p.age ?? ""}</span>
            <span className="w-14 shrink-0 text-right text-xs text-ink-2">
              {p.goals ? `${p.goals} G` : ""}
              {p.assists ? ` ${p.assists} A` : ""}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

