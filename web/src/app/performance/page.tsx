import type { Metadata } from "next";

import { PerformanceView } from "@/components/performance-view";
import { getMeta, getPerformance } from "@/lib/data";
import { T } from "@/lib/i18n";

export const metadata: Metadata = {
  title: "Track record",
  description: "How many matches the model got right in the last week, month and quarter, and by how much it missed.",
};

export default function PerformancePage() {
  const perf = getPerformance();
  const meta = getMeta();
  return (
    <>
      <section className="py-8 md:py-10">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          <T en="Track record" pt="Histórico de previsões" />
        </h1>
        <p className="mt-3 max-w-2xl text-ink-2 text-pretty">
          <T
            en="Every forecast is stored before kick-off and scored after the final whistle. Nothing is deleted or edited afterwards. Matches decided in extra time or on penalties are left out, because the 90-minute score is not known."
            pt="Cada previsão é guardada antes do jogo começar e avaliada depois do apito final. Nada é apagado nem alterado depois. Jogos decididos no prolongamento ou nos penáltis ficam de fora, porque o resultado aos 90 minutos não é conhecido."
          />
        </p>
      </section>
      <PerformanceView perf={perf} valueEdge={meta.valueEdge} />
    </>
  );
}
