import { int, num, pct } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { WindowStats } from "@/lib/types";

type Market = NonNullable<WindowStats["market"]>;

const MODEL = "var(--home)";
const BOOKIES = "var(--away)";

/** Head-to-head on the same matches: the model's pick vs the bookmakers' favourite. */
export function ModelVsMarket({ m }: { m: Market }) {
  if (!m.n || m.accuracy === null || m.modelAccuracy === null) return null;
  const d = m.disagree;
  const rows = [
    {
      en: "Correct picks",
      pt: "Previsões certas",
      model: `${pct(m.modelAccuracy, 1)}`,
      market: `${pct(m.accuracy, 1)}`,
      modelDetail: `${int(m.modelCorrect)} / ${int(m.n)}`,
      marketDetail: `${int(m.correct)} / ${int(m.n)}`,
      better: m.modelAccuracy === m.accuracy ? null : m.modelAccuracy > m.accuracy ? "model" : "market",
    },
    {
      en: "Probability given to the real result",
      pt: "Probabilidade dada ao resultado real",
      model: pct(m.modelPActual, 1),
      market: pct(m.pActual, 1),
      better:
        m.modelPActual === undefined || m.pActual === undefined || m.modelPActual === m.pActual
          ? null
          : m.modelPActual > m.pActual
            ? "model"
            : "market",
    },
    {
      en: "Brier score (lower is better)",
      pt: "Brier score (menor é melhor)",
      model: num(m.modelBrier, 3),
      market: num(m.brier, 3),
      better:
        m.modelBrier === undefined || m.brier === undefined || m.modelBrier === m.brier
          ? null
          : m.modelBrier < m.brier
            ? "model"
            : "market",
    },
  ] as const;

  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="font-semibold">
        <T en="Model vs bookmakers" pt="Modelo vs casas de apostas" />
      </h2>
      <p className="mt-1 text-sm text-ink-2">
        <T
          en={`Same ${int(m.n)} matches. The bookmakers' pick is the favourite in the odds.`}
          pt={`Os mesmos ${int(m.n)} jogos. A escolha das casas é o favorito nas odds.`}
        />
      </p>

      <div className="mt-4">
        <table className="tnum w-full table-fixed text-sm">
          <colgroup>
            <col />
            <col className="w-[5.5rem]" />
            <col className="w-[5.5rem]" />
          </colgroup>
          <thead>
            <tr className="text-left text-xs text-ink-3">
              <th className="pb-2 font-normal" />
              <th className="pb-2 text-right font-normal">
                <Key color={MODEL} />
                <T en="Model" pt="Modelo" />
              </th>
              <th className="pb-2 text-right font-normal">
                <Key color={BOOKIES} />
                <T en="Bookmakers" pt="Casas de apostas" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.en}>
                <td className="py-2 pr-3 text-ink-2">
                  <T en={r.en} pt={r.pt} />
                </td>
                <td className={`py-2 text-right align-top ${r.better === "model" ? "font-semibold" : "text-ink-2"}`}>
                  {r.model}
                  {r.better === "model" && <Better />}
                </td>
                <td className={`py-2 text-right align-top ${r.better === "market" ? "font-semibold" : "text-ink-2"}`}>
                  {r.market}
                  {r.better === "market" && <Better />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4 grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 gap-y-1.5 text-sm">
        <Bar color={MODEL} value={m.modelAccuracy} label={<T en="Model" pt="Modelo" />} />
        <Bar color={BOOKIES} value={m.accuracy} label={<T en="Bookmakers" pt="Casas" />} />
      </div>

      {d && d.n > 0 && (
        <div className="mt-5 border-t border-line pt-4">
          <h3 className="text-sm font-medium">
            <T en={`When they disagreed (${int(d.n)} matches)`} pt={`Quando discordaram (${int(d.n)} jogos)`} />
          </h3>
          <dl className="tnum mt-2 grid grid-cols-3 gap-3 text-sm">
            <div>
              <dt className="text-xs text-ink-2">
                <T en="Model was right" pt="Modelo acertou" />
              </dt>
              <dd className="text-lg font-semibold">{int(d.model)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-2">
                <T en="Bookmakers were right" pt="Casas acertaram" />
              </dt>
              <dd className="text-lg font-semibold">{int(d.market)}</dd>
            </div>
            <div>
              <dt className="text-xs text-ink-2">
                <T en="Neither" pt="Nenhum" />
              </dt>
              <dd className="text-lg font-semibold">{int(d.neither)}</dd>
            </div>
          </dl>
          <p className="mt-2 text-xs text-ink-3">
            <T
              en={`They picked the same outcome in the other ${int(m.agree)} matches.`}
              pt={`Escolheram o mesmo resultado nos outros ${int(m.agree)} jogos.`}
            />
          </p>
        </div>
      )}
    </section>
  );
}

function Key({ color }: { color: string }) {
  return <span className="mr-1.5 inline-block h-2 w-2 rounded-[2px] align-middle" style={{ background: color }} aria-hidden="true" />;
}

function Better() {
  return (
    <span className="block text-[10px] font-medium leading-3 text-ink-3">
      <T en="better" pt="melhor" />
    </span>
  );
}

function Bar({ color, value, label }: { color: string; value: number; label: React.ReactNode }) {
  return (
    <>
      <div className="flex items-center gap-2">
        <span className="w-24 shrink-0 text-xs text-ink-2">{label}</span>
        <span className="relative h-3 flex-1">
          <span className="absolute inset-y-0 left-0 rounded-r-[4px]" style={{ width: `${value * 100}%`, background: color }} />
        </span>
      </div>
      <span className="text-right font-medium">{pct(value, 1)}</span>
    </>
  );
}
