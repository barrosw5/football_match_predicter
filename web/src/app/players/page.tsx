import type { Metadata } from "next";

import { PlayersView } from "@/components/players-view";
import { getMeta, getPlayers } from "@/lib/data";
import { T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Players",
  description: "Top scorers and assist providers of every covered competition, this season.",
};

export default function PlayersPage() {
  const data = getPlayers();
  const competitions = getMeta().competitions.map((c) => ({ code: c.code, country: c.country }));
  return (
    <>
      <section className="py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <T en="Players" pt="Jogadores" />
        </h1>
        <p className="mt-3 max-w-2xl text-ink-2 text-pretty">
          <T
            en="Top scorers and assist providers of each competition this season. Line-ups of each match are on the match pages."
            pt="Melhores marcadores e assistentes de cada competição esta época. As escalações de cada jogo estão na página do jogo."
          />
        </p>
      </section>
      <PlayersView data={data} competitions={competitions} />
    </>
  );
}
