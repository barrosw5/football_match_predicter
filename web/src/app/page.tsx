import Link from "next/link";

import { FixtureBrowser } from "@/components/fixture-browser";
import { StatTile } from "@/components/stat-tile";
import { getFixtures, getMeta, getPerformance } from "@/lib/data";
import { int, num, pct } from "@/lib/format";
import { T } from "@/lib/i18n";

export default function HomePage() {
  const fixtures = getFixtures();
  const perf = getPerformance();
  const meta = getMeta();
  const month = perf.windows["30d"];
  const leagues = meta.competitions.filter((c) => c.kind === "league").length;

  return (
    <>
      <section className="grid grid-cols-1 gap-6 py-8 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] md:items-end md:py-10">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            <T en="Who wins this week, and how sure is the model?" pt="Quem ganha esta semana, e com que certeza?" />
          </h1>
          <p className="mt-3 max-w-xl text-ink-2 text-pretty">
            <T
              en={`Win, draw and loss probabilities, expected goals and likely scores for ${leagues} European leagues plus the Champions, Europa and Conference League. Retrained and refreshed automatically every day; every forecast is kept and scored once the match ends.`}
              pt={`Probabilidades de vitória, empate e derrota, golos esperados e resultados prováveis para ${leagues} ligas europeias e para a Liga dos Campeões, Liga Europa e Liga Conferência. O modelo é retreinado e atualizado todos os dias; cada previsão fica guardada e é avaliada no fim do jogo.`}
            />
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <StatTile
            label={<T en="Last 30 days" pt="Últimos 30 dias" />}
            value={pct(month.accuracy)}
            detail={
              <T
                en={`${int(month.correct)} of ${int(month.n)} correct`}
                pt={`${int(month.correct)} de ${int(month.n)} certos`}
              />
            }
          />
          <StatTile
            label={<T en="Goal error" pt="Erro de golos" />}
            value={num(month.goalMae, 2)}
            detail={<T en="avg. per team" pt="média por equipa" />}
          />
          <StatTile
            label={<T en="Favourite won" pt="Favorito ganhou" />}
            value={pct(month.market?.accuracy)}
            detail={<T en="bookmakers, same games" pt="casas de apostas, mesmos jogos" />}
          />
          <p className="col-span-3 text-right text-sm">
            <Link href="/performance/" className="text-accent underline-offset-2 hover:underline">
              <T en="Full track record" pt="Ver histórico completo" />
            </Link>
          </p>
        </div>
      </section>

      {fixtures.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface px-4 py-10 text-center text-ink-2">
          <T en="No fixtures in the next seven days." pt="Sem jogos nos próximos sete dias." />
        </p>
      ) : (
        <FixtureBrowser fixtures={fixtures} />
      )}
    </>
  );
}
