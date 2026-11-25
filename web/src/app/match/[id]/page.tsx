import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { CompetitionTag, SourceTag, Verdict } from "@/components/badges";
import { FormPills } from "@/components/form-pills";
import { LastStartingXI, MatchLineups } from "@/components/lineups";
import { MatchStats } from "@/components/match-stats";
import { RecentGames } from "@/components/recent-games";
import { OddsCalculator } from "@/components/odds-calculator";
import { ProbabilityBar } from "@/components/probability-bar";
import { ScoreMatrix } from "@/components/score-matrix";
import { TeamLogo } from "@/components/team-logo";
import { getFixtures, getLineups, getMatchHistory, getMeta, getResults, getTeams } from "@/lib/data";
import { teamSlug } from "@/lib/slug";
import { formatTime, num, pct, signed } from "@/lib/format";
import { LocalDate, OutcomeName, T } from "@/lib/i18n";
import { goalMarkets, scoreMatrix, topScores } from "@/lib/poisson";
import type { Fixture, FormGame, Outcome, Result, Team } from "@/lib/types";

export const dynamicParams = false;

function findMatch(id: string): { match: Fixture | Result; settled: boolean } | null {
  const fixture = getFixtures().find((f) => f.id === id);
  if (fixture) return { match: fixture, settled: false };
  const result = getResults().find((r) => r.id === id);
  if (result) return { match: result, settled: true };
  return null;
}

export function generateStaticParams() {
  const ids = [...getFixtures().map((f) => f.id), ...getResults().map((r) => r.id)];
  return [...new Set(ids)].map((id) => ({ id }));
}

export async function generateMetadata({ params }: PageProps<"/match/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = findMatch(id);
  if (!found) return {};
  const { match } = found;
  return {
    title: `${match.home.name} vs ${match.away.name}`,
    description: `${match.competition.name}: ${match.home.name} ${pct(match.probs.home)}, draw ${pct(match.probs.draw)}, ${match.away.name} ${pct(match.probs.away)}.`,
  };
}

const key = (o: Outcome) => (o === "H" ? "home" : o === "D" ? "draw" : "away");
const card = "rounded-2xl border border-line bg-surface p-4 sm:p-6";

export default async function MatchPage({ params }: PageProps<"/match/[id]">) {
  const { id } = await params;
  const found = findMatch(id);
  if (!found) notFound();
  const { match, settled } = found;
  const result = settled ? (match as Result) : null;
  const meta = getMeta();

  const matrix = scoreMatrix(match.xg.home, match.xg.away);
  const top = topScores(matrix, 5);
  const markets = goalMarkets(match.xg.home, match.xg.away);
  const names: [string, string] = [match.home.name, match.away.name];
  const outcome = (o: Outcome) => (
    <OutcomeName outcome={o} home={names[0]} away={names[1]} homeLogo={match.home.logo} awayLogo={match.away.logo} />
  );
  // Last 10 matches with statistics (build-time data); the form guide uses the last 5.
  const history = getMatchHistory()[match.id];
  const homeHistory = history?.home ?? match.home.form ?? [];
  const awayHistory = history?.away ?? match.away.form ?? [];
  const lineups = getLineups();
  const summary = settled ? lineups.results[match.id] : undefined;
  const lastXI = settled ? undefined : lineups.lastXI[match.id];
  const homeForm = homeHistory.slice(-5);
  const awayForm = awayHistory.slice(-5);

  return (
    <article className="py-6">
      <Link href={settled ? "/performance/" : "/"} className="text-sm text-ink-2 hover:text-ink">
        {settled ? <T en="Back to track record" pt="Voltar ao histórico" /> : <T en="Back to fixtures" pt="Voltar aos jogos" />}
      </Link>

      {/* ------------------------------------------------------------ header */}
      <header className={`mt-4 ${card} sm:p-7`}>
        <div className="flex flex-wrap items-center gap-2 text-sm text-ink-2">
          <CompetitionTag competition={match.competition} full />
          <span className="tnum">
            <LocalDate iso={match.kickoff} kind="day" />
            {match.source === "live" && <> · {formatTime(match.kickoff)}</>}
          </span>
          <SourceTag source={match.source} />
        </div>

        <div className="mt-6 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 sm:gap-4">
          <TeamBlock team={match.home} form={homeForm} align="left" />
          <div className="tnum max-w-[5.5rem] text-center sm:max-w-none">
            {result ? (
              <div className="whitespace-nowrap text-3xl font-semibold tracking-tight sm:text-5xl">
                {result.score.home}
                <span className="px-1 text-ink-3 sm:px-2">–</span>
                {result.score.away}
              </div>
            ) : (
              <div className="text-lg text-ink-3">vs</div>
            )}
            <div className="mt-1 text-xs text-ink-2">
              {result ? (
                <T en="full time" pt="final" />
              ) : (match as Fixture).status === "awaiting_result" ? (
                <T en="awaiting result" pt="a aguardar resultado" />
              ) : (
                <T en={`kick-off ${formatTime(match.kickoff)}`} pt={`início ${formatTime(match.kickoff)}`} />
              )}
            </div>
          </div>
          <TeamBlock team={match.away} form={awayForm} align="right" />
        </div>

        <div className="mt-7">
          <ProbabilityBar probs={match.probs} pick={match.pick} size="lg" names={names} />
        </div>
      </header>

      {/* ------------------------------------------- model vs bookmakers */}
      <section className={`mt-4 ${card}`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold">
            {result ? <T en="How the forecast did" pt="Como correu a previsão" /> : <T en="Model vs bookmakers" pt="Modelo vs casas de apostas" />}
          </h2>
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <PickCard
            title={<T en="Model prediction" pt="Previsão do modelo" />}
            pick={outcome(match.pick)}
            prob={match.probs[key(match.pick)]}
            verdict={result ? <Verdict correct={result.correct} /> : null}
          />
          {match.market ? (
            <PickCard
              title={<T en="Bookmakers' favourite" pt="Favorito das casas de apostas" />}
              pick={outcome(match.market.pick)}
              prob={match.market.probs[key(match.market.pick)]}
              verdict={result && result.marketCorrect !== null ? <Verdict correct={result.marketCorrect} /> : null}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-line p-4 text-sm text-ink-2">
              <T en="No bookmaker odds for this match." pt="Sem odds das casas de apostas para este jogo." />
            </div>
          )}
        </div>

        {result && (
          <dl className="tnum mt-5 grid gap-4 border-t border-line pt-4 text-sm sm:grid-cols-3">
            <Fact
              label={<T en="Probability given to the real result" pt="Probabilidade dada ao resultado real" />}
              value={pct(result.pActual)}
              detail={outcome(result.actual)}
            />
            <Fact
              label={<T en="Likely score vs final" pt="Resultado provável vs final" />}
              value={`${result.predScore.replace("-", "–")}  /  ${result.score.home}–${result.score.away}`}
              detail={result.exactScore ? <T en="exact score" pt="resultado exato" /> : <T en="not exact" pt="não exato" />}
            />
            <Fact
              label={<T en="Goal error" pt="Erro de golos" />}
              value={num(result.goalError, 2)}
              detail={`xG ${num(match.xg.home, 1)}–${num(match.xg.away, 1)}`}
            />
          </dl>
        )}

        {match.odds && <MarketTable match={match} names={names} edge={meta.valueEdge} />}
      </section>

      <section className={`mt-4 ${card}`}>
        <h2 className="font-semibold">
          <T en="Recent matches" pt="Últimos jogos" />
        </h2>
        <p className="mt-1 text-sm text-ink-2">
          <T
            en="Each team's last 5 matches before this one, most recent first. Scores from that team's side."
            pt="Os últimos 5 jogos de cada equipa antes deste, do mais recente para o mais antigo. Resultados do ponto de vista dessa equipa."
          />
        </p>
        <div className="mt-4 grid grid-cols-1 gap-6 md:grid-cols-2">
          <RecentGames team={match.home.name} logo={match.home.logo} games={homeForm} />
          <RecentGames team={match.away.name} logo={match.away.logo} games={awayForm} />
        </div>
      </section>

      {summary && (
        <section className={`mt-4 ${card}`}>
          <h2 className="mb-4 font-semibold">
            <T en="Line-ups and key events" pt="Escalações e lances principais" />
          </h2>
          <MatchLineups summary={summary} home={match.home} away={match.away} />
        </section>
      )}

      {lastXI && (
        <section className={`mt-4 ${card}`}>
          <h2 className="font-semibold">
            <T en="Previous starting XI" pt="Último onze inicial" />
          </h2>
          <p className="mb-4 mt-1 text-sm text-ink-2">
            <T
              en="Who started each team's previous match. Confirmed line-ups are only published about an hour before kick-off, and injuries are not covered."
              pt="Quem foi titular no jogo anterior de cada equipa. As escalações oficiais só saem cerca de uma hora antes do jogo e as lesões não estão incluídas."
            />
          </p>
          <LastStartingXI home={match.home} away={match.away} data={lastXI} />
        </section>
      )}

      <section className={`mt-4 ${card}`}>
        <h2 className="font-semibold">
          <T en="Statistics" pt="Estatísticas" />
        </h2>
        <p className="mb-4 mt-1 text-sm text-ink-2">
          <T
            en="What the model expects for this match, and what both teams have been producing lately."
            pt="O que o modelo espera para este jogo e o que as duas equipas têm produzido nos últimos jogos."
          />
        </p>
        <MatchStats
          home={{ name: match.home.name, logo: match.home.logo, games: homeHistory }}
          away={{ name: match.away.name, logo: match.away.logo, games: awayHistory }}
          expected={{ xgHome: match.xg.home, xgAway: match.xg.away, btts: markets.btts, over25: markets.over25 }}
        />
      </section>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <section className={card}>
          <h2 className="font-semibold">
            <T en="Correct score" pt="Resultado exato" />
          </h2>
          <p className="mt-1 text-sm text-ink-2">
            <T en="Expected goals" pt="Golos esperados" /> <span className="tnum text-ink">{num(match.xg.home, 2)}</span> –{" "}
            <span className="tnum text-ink">{num(match.xg.away, 2)}</span>.{" "}
            <T en="Each cell is the chance of that exact score (%)." pt="Cada célula é a probabilidade desse resultado (%)." />
          </p>
          <div className="mt-4">
            <ScoreMatrix
              matrix={matrix}
              home={match.home.name}
              away={match.away.name}
              homeLogo={match.home.logo}
              awayLogo={match.away.logo}
            />
          </div>
        </section>

        <div className="grid content-start gap-4">
          <section className={card}>
            <h2 className="font-semibold">
              <T en="Most likely scores" pt="Resultados mais prováveis" />
            </h2>
            <ol className="tnum mt-3 space-y-2 text-sm">
              {top.map((s, i) => (
                <li key={i} className="grid grid-cols-[3rem_1fr_3.5rem] items-center gap-3">
                  <span className="font-medium">
                    {s.home}–{s.away}
                  </span>
                  <span className="h-2 rounded-r-[4px] bg-[var(--seq-4)]" style={{ width: `${(s.p / top[0].p) * 100}%` }} />
                  <span className="text-right text-ink-2">{pct(s.p, 1)}</span>
                </li>
              ))}
            </ol>
            <dl className="tnum mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4 text-sm">
              <Fact label={<T en="Both teams score" pt="Ambas marcam" />} value={pct(markets.btts)} />
              <Fact label={<T en="Over 2.5 goals" pt="Mais de 2,5 golos" />} value={pct(markets.over25)} />
            </dl>
          </section>

          {!settled && (
            <section className={card}>
              <h2 className="font-semibold">
                <T en="Check your own odds" pt="Testa as tuas odds" />
              </h2>
              <p className="mb-4 mt-1 text-sm text-ink-2">
                <T en="Type the decimal odds your bookmaker offers." pt="Escreve as odds decimais da tua casa de apostas." />
              </p>
              <OddsCalculator probs={match.probs} odds={match.odds} names={names} />
            </section>
          )}
        </div>
      </div>
    </article>
  );
}

function TeamBlock({ team, form, align }: { team: Team; form?: FormGame[]; align: "left" | "right" }) {
  const slug = teamSlug(team.key);
  const hasPage = slug in getTeams();
  const identity = (
    <>
      <TeamLogo id={team.logo} name={team.name} size={44} />
      <span className="text-lg font-semibold leading-tight tracking-tight text-balance break-words sm:text-2xl">{team.name}</span>
    </>
  );
  return (
    <div className={`flex min-w-0 flex-col gap-2 ${align === "right" ? "items-end text-right" : ""}`}>
      {hasPage ? (
        <Link href={`/team/${slug}/`} className={`flex flex-col gap-2 hover:underline ${align === "right" ? "items-end" : ""}`}>
          {identity}
        </Link>
      ) : (
        <div className={`flex flex-col gap-2 ${align === "right" ? "items-end" : ""}`}>{identity}</div>
      )}
      <div className={`flex flex-wrap items-center gap-2 text-xs text-ink-2 ${align === "right" ? "justify-end" : ""}`}>
        {team.elo !== null && <span className="tnum">Elo {Math.round(team.elo)}</span>}
        {team.value != null && (
          <span className="tnum" title="Transfermarkt">
            <T en="Squad" pt="Plantel" /> {team.value >= 1000 ? `${(team.value / 1000).toFixed(2)} B€` : `${Math.round(team.value)} M€`}
          </span>
        )}
        {form && form.length > 0 && <FormPills games={form} />}
      </div>
    </div>
  );
}

function PickCard({ title, pick, prob, verdict }: { title: ReactNode; pick: ReactNode; prob: number; verdict: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-2">
        <span>{title}</span>
        {verdict}
      </div>
      <div className="mt-1.5 text-lg font-semibold">{pick}</div>
      <div className="tnum text-sm text-ink-2">{pct(prob)}</div>
    </div>
  );
}

function Fact({ label, value, detail }: { label: ReactNode; value: string; detail?: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-ink-2">{label}</dt>
      <dd className="mt-0.5 whitespace-pre text-base font-semibold">{value}</dd>
      {detail && <dd className="text-xs text-ink-2">{detail}</dd>}
    </div>
  );
}

function MarketTable({ match, names, edge }: { match: Fixture | Result; names: [string, string]; edge: number }) {
  const odds = match.odds!;
  const inv = { home: 1 / odds.home, draw: 1 / odds.draw, away: 1 / odds.away };
  const total = inv.home + inv.draw + inv.away;
  const rows = (["home", "draw", "away"] as const).map((k) => ({
    k,
    label: k === "home" ? names[0] : k === "away" ? names[1] : <T en="Draw" pt="Empate" />,
    odds: odds[k],
    implied: inv[k] / total,
    model: match.probs[k],
    ev: match.probs[k] * odds[k] - 1,
  }));
  return (
    <div className="mt-5 border-t border-line pt-4">
      <div className="overflow-x-auto">
        <table className="tnum w-full min-w-[28rem] text-sm">
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="pb-2 font-normal">
                <T en="Outcome" pt="Resultado" />
              </th>
              <th className="pb-2 text-right font-normal">Odds</th>
              <th className="pb-2 text-right font-normal">
                <T en="Bookmakers" pt="Casas" />
              </th>
              <th className="pb-2 text-right font-normal">
                <T en="Model" pt="Modelo" />
              </th>
              <th className="pb-2 text-right font-normal">
                <T en="Difference" pt="Diferença" />
              </th>
              <th className="pb-2 text-right font-normal">
                <T en="Exp. value" pt="Valor esperado" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.k}>
                <td className="max-w-40 truncate py-1.5">{r.label}</td>
                <td className="py-1.5 text-right">{num(r.odds, 2)}</td>
                <td className="py-1.5 text-right text-ink-2">{pct(r.implied)}</td>
                <td className="py-1.5 text-right font-medium">{pct(r.model)}</td>
                <td className="py-1.5 text-right text-ink-2">{signed((r.model - r.implied) * 100, 0, " pp")}</td>
                <td className={`py-1.5 text-right ${r.ev > edge ? "font-medium text-good-ink" : "text-ink-2"}`}>
                  {signed(r.ev * 100, 1, "%")}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-2">
        <T
          en={`Odds: ${odds.source ?? "bookmaker"}. Bookmaker probabilities have their margin (${pct(total - 1, 1)}) removed. A value pick needs an expected value above ${pct(edge)}.`}
          pt={`Odds: ${odds.source === "Market average" ? "média do mercado" : (odds.source ?? "casa de apostas")}. As probabilidades das casas estão sem a margem (${pct(total - 1, 1)}). Uma aposta de valor precisa de valor esperado acima de ${pct(edge)}.`}
        />
      </p>
    </div>
  );
}
