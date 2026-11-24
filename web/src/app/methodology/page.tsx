import type { Metadata } from "next";
import type { ReactNode } from "react";

import { getEvaluation, getMeta } from "@/lib/data";
import { int, num, pct } from "@/lib/format";
import { competitionName, countryName, T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "How it works",
  description: "Data sources, features, model and validation behind the forecasts.",
};

const STEPS = [
  {
    en: ["Collect", "Results, shots, xG and odds for 21 leagues; UEFA matches, fixtures and live scores."],
    pt: ["Recolher", "Resultados, remates, xG e odds de 21 ligas; jogos UEFA, calendário e resultados em direto."],
  },
  {
    en: ["Build features", "Elo ratings, recent form, league table, rest days and market prices, all known before kick-off."],
    pt: ["Criar variáveis", "Elo, forma recente, classificação, dias de descanso e odds, tudo conhecido antes do jogo."],
  },
  {
    en: ["Train", "Gradient-boosted trees for the 1X2 outcome plus two Poisson models for each side's goals."],
    pt: ["Treinar", "Árvores gradient boosting para o 1X2 e dois modelos de Poisson para os golos de cada equipa."],
  },
  {
    en: ["Forecast & log", "Fixtures for the next 7 days are predicted and written to a ledger that is frozen at kick-off."],
    pt: ["Prever e registar", "Os jogos dos próximos 7 dias são previstos e guardados num registo que fica fixo no início do jogo."],
  },
  {
    en: ["Score & publish", "Finished matches are scored and this site is rebuilt. Runs three times a day on GitHub Actions: early morning, before lunchtime and before the evening games."],
    pt: ["Avaliar e publicar", "Os jogos terminados são avaliados e o site é reconstruído. Corre três vezes por dia no GitHub Actions: de madrugada, antes dos jogos da hora de almoço e antes dos jogos da noite."],
  },
];

const FEATURES = [
  {
    en: ["Elo ratings", "One rating per club across league and European games, with home advantage and a margin-of-victory factor. Clubs from leagues outside the dataset get their rating from European matches."],
    pt: ["Ratings Elo", "Um rating por clube em jogos de liga e europeus, com vantagem de jogar em casa e peso da margem de vitória. Clubes de ligas fora da base de dados ganham rating nos jogos europeus."],
  },
  {
    en: ["Recent form", "Points, goals, shots, shots on target, corners, cards and xG over the last 5 and 10 matches; home-only and away-only form."],
    pt: ["Forma recente", "Pontos, golos, remates, remates à baliza, cantos, cartões e xG nos últimos 5 e 10 jogos; forma só em casa e só fora."],
  },
  {
    en: ["League table", "Position, points and goal difference per game so far this season."],
    pt: ["Classificação", "Posição, pontos e diferença de golos por jogo nesta época."],
  },
  {
    en: ["Schedule", "Days since each team's previous match and matches played in the last 14 days. League, cup and European games all count, so midweek Champions League or cup fixtures are included."],
    pt: ["Calendário", "Dias desde o jogo anterior de cada equipa e jogos disputados nos últimos 14 dias. Contam jogos de liga, de taça e europeus, por isso os jogos a meio da semana (Liga dos Campeões, taças) entram nas contas."],
  },
  {
    en: ["Competition context", "Recent goals per game, home-win and draw rates of the competition; league tier, domestic cup and UEFA flags."],
    pt: ["Contexto da competição", "Golos por jogo, percentagem de vitórias em casa e de empates na competição; divisão, taça nacional ou competição UEFA."],
  },
  {
    en: ["Market", "Bookmaker odds converted to probabilities with the margin removed, when available."],
    pt: ["Mercado", "Odds das casas de apostas convertidas em probabilidades, sem a margem, quando existem."],
  },
];

const MODEL_ROWS: Record<string, string> = {
  "Historical frequencies": "Frequências históricas",
  "Elo only (logistic)": "Só Elo (logística)",
  "Poisson goals model": "Modelo de golos (Poisson)",
  "XGBoost classifier": "Classificador XGBoost",
  "Final model (blend)": "Modelo final (combinação)",
  "Bookmakers (matches with odds)": "Casas de apostas (jogos com odds)",
  "Final model (same matches)": "Modelo final (mesmos jogos)",
};

export default function MethodologyPage() {
  const meta = getMeta();
  const evaluation = getEvaluation();
  const leagues = meta.competitions.filter((c) => c.kind === "league");
  const uefa = meta.competitions.filter((c) => c.kind === "cup" && c.country === "Europe");
  const cups = meta.competitions.filter((c) => c.kind === "cup" && c.country !== "Europe");

  return (
    <div className="max-w-4xl">
      <section className="py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <T en="How it works" pt="Como funciona" />
        </h1>
        <p className="mt-3 text-ink-2 text-pretty">
          <T
            en="A Python pipeline downloads match data, rebuilds every feature, retrains the model and publishes forecasts. This website is a static Next.js site regenerated from the pipeline's JSON output, so there is no server to keep alive."
            pt="Um pipeline em Python descarrega os dados dos jogos, recalcula todas as variáveis, retreina o modelo e publica as previsões. Este site é estático (Next.js) e é regenerado a partir do JSON do pipeline, por isso não há nenhum servidor para manter ligado."
          />
        </p>
      </section>

      <ol className="grid grid-cols-1 gap-2 md:grid-cols-5">
        {STEPS.map((s, i) => (
          <li key={s.en[0]} className="rounded-xl border border-line bg-surface p-4">
            <div className="tnum text-xs text-ink-3">
              <T en={`Step ${i + 1}`} pt={`Passo ${i + 1}`} />
            </div>
            <div className="mt-1 font-semibold">
              <T en={s.en[0]} pt={s.pt[0]} />
            </div>
            <p className="mt-1.5 text-sm leading-6 text-ink-2">
              <T en={s.en[1]} pt={s.pt[1]} />
            </p>
          </li>
        ))}
      </ol>

      <Section en="Data" pt="Dados">
        <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Card title="football-data.co.uk">
            <T
              en={`${leagues.length} domestic leagues since 2014/15: results, shots, corners, cards, bookmaker odds and, from 2026/27, expected goals (xG).`}
              pt={`${leagues.length} ligas nacionais desde 2014/15: resultados, remates, cantos, cartões, odds e, a partir de 2026/27, golos esperados (xG).`}
            />
          </Card>
          <Card title="ESPN">
            <T
              en={`${uefa.map((c) => competitionName(c.code, c.name, "en")).join(", ")} since 2014 and ${cups.length} domestic cups (${cups.map((c) => c.name).join(", ")}), plus every fixture, kick-off time, live result, club crest and DraftKings odds for the coming week. Clubs are matched across competitions by their ESPN team id.`}
              pt={`${uefa.map((c) => competitionName(c.code, c.name, "pt")).join(", ")} desde 2014 e ${cups.length} taças nacionais (${cups.map((c) => competitionName(c.code, c.name, "pt")).join(", ")}), mais o calendário, horários, resultados em direto, emblemas dos clubes e odds DraftKings da próxima semana. Os clubes são identificados entre competições pelo ID de equipa da ESPN.`}
            />
          </Card>
        </dl>
        <p className="mt-4 text-sm text-ink-2">
          <T
            en={`${int(meta.counts.matchesInDatabase)} matches from ${meta.dataRange.from} to ${meta.dataRange.to}. Club names differ between sources ("Atlético Madrid" vs "Ath Madrid"), so a matcher combines an alias table, accent-insensitive keys and same-country fuzzy matching.`}
            pt={`${int(meta.counts.matchesInDatabase)} jogos de ${meta.dataRange.from} a ${meta.dataRange.to}. Os nomes dos clubes variam entre fontes ("Atlético Madrid" vs "Ath Madrid"), por isso há um sistema que junta uma tabela de nomes alternativos, comparação sem acentos e correspondência aproximada dentro do mesmo país.`}
          />
        </p>
        <details className="mt-3 text-sm">
          <summary className="cursor-pointer text-ink-2 hover:text-ink">
            <T en="Competitions covered" pt="Competições incluídas" />
          </summary>
          <ul className="mt-2 grid gap-x-6 gap-y-1 sm:grid-cols-3">
            {meta.competitions.map((c) => (
              <li key={c.code}>
                <T en={competitionName(c.code, c.name, "en")} pt={competitionName(c.code, c.name, "pt")} />{" "}
                <span className="text-ink-3">
                  · <T en={countryName(c.country, "en")} pt={countryName(c.country, "pt")} />
                </span>
              </li>
            ))}
          </ul>
        </details>
      </Section>

      <Section en="Features" pt="Variáveis">
        <p className="mb-4 text-sm text-ink-2">
          <T
            en="Each feature is computed only from matches played before kick-off: running Elo and league tables record a team's state before applying a result, and rolling statistics are joined with a strictly-earlier as-of merge. The same code builds training rows and forecasts."
            pt="Cada variável usa apenas jogos anteriores ao início da partida: o Elo e a classificação guardam o estado da equipa antes de aplicar cada resultado, e as médias móveis são ligadas apenas a jogos estritamente anteriores. O mesmo código cria os dados de treino e as previsões."
          />
        </p>
        <dl className="divide-y divide-line rounded-xl border border-line bg-surface">
          {FEATURES.map((f) => (
            <div key={f.en[0]} className="grid gap-1 px-4 py-3 sm:grid-cols-[11rem_1fr]">
              <dt className="font-medium">
                <T en={f.en[0]} pt={f.pt[0]} />
              </dt>
              <dd className="text-sm leading-6 text-ink-2">
                <T en={f.en[1]} pt={f.pt[1]} />
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section en="Model" pt="Modelo">
        <ul className="space-y-2 text-sm leading-6 text-ink-2">
          <Bullet
            en={["Outcome model.", "An XGBoost classifier gives the home, draw and away probabilities."]}
            pt={["Modelo de resultado.", "Um classificador XGBoost dá as probabilidades de vitória da casa, empate e vitória de fora."]}
          />
          <Bullet
            en={["Goals model.", "Two XGBoost regressors with a Poisson objective predict each side's expected goals, which give the correct-score grid, both-teams-to-score and over/under 2.5."]}
            pt={["Modelo de golos.", "Dois regressores XGBoost com objetivo Poisson preveem os golos esperados de cada equipa, de onde saem a matriz de resultados exatos, ambas marcam e mais/menos de 2,5 golos."]}
          />
          <Bullet
            en={["Which model gives the 1X2.", "Blends of the classifier and the goals model were compared by walk-forward validation; since the domestic cups were added, the classifier alone scores best, so it gives the published probabilities and the goals model gives the scores."]}
            pt={["Que modelo dá o 1X2.", "Foram comparadas combinações do classificador com o modelo de golos em validação temporal; desde que as taças entraram, o classificador sozinho é o melhor, por isso é ele que dá as probabilidades publicadas e o modelo de golos dá os resultados."]}
          />
          <Bullet
            en={["Recency.", "Training matches are weighted with a 4-year half-life, so the model follows changes in the game such as the drop in home advantage after 2020."]}
            pt={["Atualidade.", "Os jogos de treino têm peso com meia-vida de 4 anos, para o modelo acompanhar mudanças no futebol, como a quebra da vantagem de jogar em casa depois de 2020."]}
          />
        </ul>
        {meta.model.n_train !== undefined && (
          <p className="tnum mt-4 text-sm text-ink-2">
            <T
              en={`Current model: trained on ${int(meta.model.n_train)} matches (${meta.model.train_start} to ${meta.model.train_end}), ${meta.model.n_features} features, version ${meta.model.version ?? ""}.`}
              pt={`Modelo atual: treinado com ${int(meta.model.n_train)} jogos (${meta.model.train_start} a ${meta.model.train_end}), ${meta.model.n_features} variáveis, versão ${meta.model.version ?? ""}.`}
            />
          </p>
        )}
      </Section>

      <Section en="Validation" pt="Validação">
        {evaluation ? (
          <>
            <p className="mb-4 text-sm text-ink-2">
              <T
                en={`Out-of-sample results on ${evaluation.testPeriod}: each season is predicted by a model trained only on earlier seasons. Lower is better for log loss, Brier score and RPS.`}
                pt={`Resultados fora da amostra (${evaluation.testPeriod.replace("the ", "").replace(" to ", " a ").replace(" seasons", "")}): cada época é prevista por um modelo treinado só com épocas anteriores. Log loss, Brier e RPS: menor é melhor.`}
              />
            </p>
            <div className="overflow-x-auto rounded-xl border border-line bg-surface">
              <table className="tnum w-full min-w-[32rem] text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="px-4 py-2.5 font-normal">
                      <T en="Model" pt="Modelo" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-normal">
                      <T en="Matches" pt="Jogos" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-normal">
                      <T en="Accuracy" pt="Acerto" />
                    </th>
                    <th className="px-2 py-2.5 text-right font-normal">Log loss</th>
                    <th className="px-2 py-2.5 text-right font-normal">Brier</th>
                    <th className="px-4 py-2.5 text-right font-normal">RPS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {evaluation.rows.map((r) => (
                    <tr key={r.model}>
                      <td className="px-4 py-2.5">
                        <T en={r.model} pt={MODEL_ROWS[r.model] ?? r.model} />
                      </td>
                      <td className="px-2 py-2.5 text-right text-ink-2">{int(r.n)}</td>
                      <td className="px-2 py-2.5 text-right">{pct(r.accuracy, 1)}</td>
                      <td className="px-2 py-2.5 text-right">{num(r.logLoss, 4)}</td>
                      <td className="px-2 py-2.5 text-right">{num(r.brier, 4)}</td>
                      <td className="px-4 py-2.5 text-right">{num(r.rps, 4)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-ink-2">
            <T
              en="Run notebooks/02_modelling.ipynb to publish the validation table here."
              pt="Corre o notebooks/02_modelling.ipynb para publicar aqui a tabela de validação."
            />
          </p>
        )}
      </Section>

      <Section en="Limitations" pt="Limitações">
        <ul className="list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-2">
          <li>
            <T
              en="No team news: injuries, suspensions and rotation are invisible to the model until they show up in results."
              pt="Sem notícias das equipas: lesões, castigos e rotação só entram no modelo quando aparecem nos resultados."
            />
          </li>
          <li>
            <T
              en="Accuracy tops out around 50–55% for any 1X2 model; bookmakers sit in the same range."
              pt="Qualquer modelo 1X2 fica por volta de 50–55% de acerto; as casas de apostas estão no mesmo intervalo."
            />
          </li>
          <li>
            <T
              en="xG only exists from 2026/27, so its features matter little until more seasons accumulate."
              pt="O xG só existe a partir de 2026/27, por isso pesa pouco até haver mais épocas."
            />
          </li>
          <li>
            <T
              en="Clubs from countries outside the dataset are rated from their European games only."
              pt="Clubes de países fora da base de dados são avaliados só pelos jogos europeus."
            />
          </li>
        </ul>
      </Section>
    </div>
  );
}

function Section({ en, pt, children }: { en: string; pt: string; children: ReactNode }) {
  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-semibold tracking-tight">
        <T en={en} pt={pt} />
      </h2>
      {children}
    </section>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <dt className="font-semibold">{title}</dt>
      <dd className="mt-1.5 text-sm leading-6 text-ink-2">{children}</dd>
    </div>
  );
}

function Bullet({ en, pt }: { en: [string, string]; pt: [string, string] }) {
  return (
    <li>
      <T
        en={
          <>
            <strong className="font-medium text-ink">{en[0]}</strong> {en[1]}
          </>
        }
        pt={
          <>
            <strong className="font-medium text-ink">{pt[0]}</strong> {pt[1]}
          </>
        }
      />
    </li>
  );
}
