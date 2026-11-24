import type { Metadata } from "next";

import { RankingTable } from "@/components/ranking-table";
import { getRanking } from "@/lib/data";
import { T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Elo ranking",
  description: "Every club rated on one scale across leagues, domestic cups and UEFA competitions.",
};

export default function RankingPage() {
  const ranking = getRanking();
  return (
    <>
      <section className="py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <T en="Elo ranking" pt="Ranking Elo" />
        </h1>
        <p className="mt-3 max-w-2xl text-ink-2 text-pretty">
          <T
            en="Every club on one scale. A win against a strong opponent, away from home or by a big margin moves the rating more. League, cup and European matches all count, so clubs from different countries can be compared. It is the same rating the model uses."
            pt="Todos os clubes na mesma escala. Ganhar a um adversário forte, fora de casa ou por muitos golos mexe mais no rating. Contam os jogos de liga, de taça e europeus, por isso dá para comparar clubes de países diferentes. É o mesmo rating que o modelo usa."
          />
        </p>
      </section>
      {ranking.clubs.length === 0 ? (
        <p className="text-ink-2">
          <T en="No ranking data yet." pt="Ainda não há dados de ranking." />
        </p>
      ) : (
        <RankingTable clubs={ranking.clubs} valueDate={ranking.valueDate} />
      )}
    </>
  );
}
