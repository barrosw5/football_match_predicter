"use client";

import { useState } from "react";

import { pct } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

/** Sequential single-hue ramp (light -> dark = unlikely -> likely). */
function cellColor(p: number, max: number): string {
  const steps = 7;
  const t = max > 0 ? p / max : 0;
  const idx = Math.min(steps, Math.max(0, Math.round(t * steps)));
  return `var(--seq-${idx})`;
}

type Cell = { h: number; a: number };

/**
 * Correct-score grid laid out like a chart: home goals on the vertical axis (0 at the
 * bottom), away goals on the horizontal axis (0 on the left). Cells show percentages.
 */
export function ScoreMatrix({ matrix, home, away }: { matrix: number[][]; home: string; away: string }) {
  const lang = useLang();
  const [hover, setHover] = useState<Cell | null>(null);
  const max = Math.max(...matrix.flat());
  const size = matrix.length;
  let best: Cell = { h: 0, a: 0 };
  matrix.forEach((row, h) =>
    row.forEach((p, a) => {
      if (p > matrix[best.h][best.a]) best = { h, a };
    }),
  );
  const active = hover ?? best;
  const goals = (team: string) => tr(lang, `${team} goals`, `Golos ${team}`);
  const rowsTopDown = [...matrix.keys()].reverse(); // 5, 4, ... 0

  return (
    <figure>
      <div className="flex gap-2">
        <div className="flex w-5 items-center justify-center">
          <span className="-rotate-90 whitespace-nowrap text-xs text-ink-2">{goals(home)}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="grid gap-0.5" style={{ gridTemplateColumns: `1.5rem repeat(${size}, minmax(0, 1fr))` }}>
            {rowsTopDown.map((h) => (
              <Row
                key={h}
                h={h}
                row={matrix[h]}
                max={max}
                active={active}
                onHover={setHover}
                home={home}
                away={away}
              />
            ))}
            <span />
            {Array.from({ length: size }, (_, a) => (
              <span key={a} className="tnum pt-1 text-center text-xs text-ink-3">
                {a}
              </span>
            ))}
          </div>
          <div className="mt-1 text-center text-xs text-ink-2">{goals(away)}</div>
        </div>
      </div>
      <figcaption className="tnum mt-3 min-h-5 text-sm" aria-live="polite">
        <span className="font-semibold">{pct(matrix[active.h][active.a], 1)}</span>{" "}
        <span className="text-ink-2">
          {tr(lang, "chance of", "de probabilidade de")} {home} {active.h} – {active.a} {away}
        </span>
      </figcaption>
    </figure>
  );
}

function Row({
  h,
  row,
  max,
  active,
  onHover,
  home,
  away,
}: {
  h: number;
  row: number[];
  max: number;
  active: Cell;
  onHover: (v: Cell | null) => void;
  home: string;
  away: string;
}) {
  return (
    <>
      <span className="tnum flex items-center justify-end pr-1 text-xs text-ink-3">{h}</span>
      {row.map((p, a) => {
        const isActive = active.h === h && active.a === a;
        const dark = p / max > 0.55;
        return (
          <button
            key={a}
            type="button"
            onPointerEnter={() => onHover({ h, a })}
            onPointerLeave={() => onHover(null)}
            onFocus={() => onHover({ h, a })}
            onBlur={() => onHover(null)}
            aria-label={`${home} ${h} – ${a} ${away}: ${pct(p, 1)}`}
            className={`tnum flex aspect-[1.6] items-center justify-center rounded-sm text-[10px] sm:text-[11px] ${
              isActive ? "outline-2 outline-offset-1 outline-ink" : ""
            }`}
            style={{ background: cellColor(p, max), color: dark ? "var(--seq-on-high)" : "var(--ink)" }}
          >
            {p >= 0.0005 ? pct(p, 1) : ""}
          </button>
        );
      })}
    </>
  );
}
