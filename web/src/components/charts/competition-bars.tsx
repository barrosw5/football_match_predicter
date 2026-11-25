import { int, pct } from "@/lib/format";
import { competitionName, countryName, T } from "@/lib/i18n";
import type { WindowStats } from "@/lib/types";

/** Accuracy per competition as horizontal bars, value at the tip, sample size alongside. */
export function CompetitionBars({ rows, overall }: { rows: WindowStats["byCompetition"]; overall?: number }) {
  if (rows.length === 0)
    return (
      <p className="text-sm text-ink-2">
        <T en="No settled matches in this period." pt="Sem jogos avaliados neste período." />
      </p>
    );
  const sorted = [...rows].sort((a, b) => b.accuracy - a.accuracy);
  const label = (r: (typeof rows)[number], lang: "en" | "pt") => {
    const name = competitionName(r.code, r.name, lang);
    return r.country === "Europe" ? name : `${name} · ${countryName(r.country, lang)}`;
  };
  return (
    <div>
      <ul className="grid grid-cols-1 gap-x-10 gap-y-3 text-sm sm:gap-y-1.5 lg:grid-cols-2">
        {sorted.map((r) => (
          <li
            key={r.code}
            className="grid grid-cols-[minmax(0,1fr)_3.5rem] items-center gap-x-3 sm:grid-cols-[minmax(0,11.5rem)_minmax(0,1fr)_3.5rem]"
            title={`${r.correct} / ${r.n}`}
          >
            <span className="col-start-1 row-start-1 truncate text-ink-2">
              <T en={label(r, "en")} pt={label(r, "pt")} />
            </span>
            <span className="relative col-start-1 row-start-2 h-4 sm:col-start-2 sm:row-start-1 sm:h-5">
              <span
                className="grow-x absolute inset-y-1 left-0 rounded-r-[4px] bg-[var(--home)]"
                style={{ width: `${Math.max(1, r.accuracy * 100)}%` }}
              />
              {overall !== undefined && (
                <span
                  className="absolute inset-y-0 w-px bg-[var(--ink-3)]"
                  style={{ left: `${overall * 100}%` }}
                  aria-hidden="true"
                />
              )}
            </span>
            <span className="tnum col-start-2 row-span-2 row-start-1 self-center text-right sm:col-start-3 sm:row-span-1">
              <span className="font-medium">{pct(r.accuracy)}</span>
              <span className="block text-[11px] leading-3 text-ink-3">
                <T en={`${int(r.n)} games`} pt={`${int(r.n)} jogos`} />
              </span>
            </span>
          </li>
        ))}
      </ul>
      {overall !== undefined && (
        <p className="mt-3 flex items-center gap-2 text-xs text-ink-2">
          <span className="inline-block h-3 w-px bg-[var(--ink-3)]" aria-hidden="true" />
          <T
            en={`overall accuracy ${pct(overall)}. Small samples swing a lot.`}
            pt={`acerto global ${pct(overall)}. Amostras pequenas variam muito.`}
          />
        </p>
      )}
    </div>
  );
}
