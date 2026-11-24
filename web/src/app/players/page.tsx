import type { Metadata } from "next";

import { PlayersTable } from "@/components/players-table";
import { PlayersView } from "@/components/players-view";
import { getMeta, getPlayers } from "@/lib/data";
import { T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Players",
  description: "Player statistics and market values, plus top scorers and assist providers of every competition.",
};

export default function PlayersPage() {
  const data = getPlayers();
  const competitions = getMeta().competitions.map((c) => ({ code: c.code, country: c.country, logo: c.logo }));
  return (
    <>
      <section className="py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <T en="Players" pt="Jogadores" />
        </h1>
        <p className="mt-3 max-w-2xl text-ink-2 text-pretty">
          <T
            en="Every player's season so far: appearances, goals, assists, shots, fouls and cards, with their market value. Click a column to sort, or a name to open the player's page."
            pt="A época de cada jogador até agora: jogos, golos, assistências, remates, faltas e cartões, com o valor de mercado. Clica numa coluna para ordenar ou num nome para abrir a página do jogador."
          />
        </p>
      </section>
      <PlayersTable competitions={competitions} />

      <section className="mt-12">
        <h2 className="mb-1 text-xl font-semibold tracking-tight">
          <T en="Season leaders" pt="Líderes da época" />
        </h2>
        <p className="mb-4 text-sm text-ink-2">
          <T en="Official ESPN leaders, counting every match of the competition." pt="Líderes oficiais da ESPN, contando todos os jogos da competição." />
        </p>
        <PlayersView data={data} competitions={competitions} />
      </section>
    </>
  );
}
