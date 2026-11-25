"use client";

import { useState } from "react";

import { int, pct } from "@/lib/format";
import { tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

import { useWidth } from "./use-width";

type Bin = { bin: number; predicted: number; observed: number; n: number };

const M = { top: 12, right: 20, bottom: 34, left: 40 };

/**
 * Reliability diagram: when the model says "40%", does it happen ~40% of the time?
 * Points on the diagonal = perfectly calibrated probabilities.
 */
export function CalibrationChart({ bins }: { bins: Bin[] }) {
  const [ref, width] = useWidth<HTMLDivElement>(360);
  const [hover, setHover] = useState<number | null>(null);
  const lang = useLang();
  if (bins.length === 0)
    return <p className="text-sm text-ink-2">{tr(lang, "Not enough data yet.", "Ainda não há dados suficientes.")}</p>;

  const size = Math.min(width, 380);
  const inner = size - M.left - M.right;
  const height = inner + M.top + M.bottom;
  const x = (v: number) => M.left + v * inner;
  const y = (v: number) => M.top + inner - v * inner;
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  const line = bins.map((b, i) => `${i ? "L" : "M"}${x(b.predicted)},${y(b.observed)}`).join(" ");
  const active = hover !== null ? bins[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        width={size}
        height={height}
        role="img"
        aria-label={tr(
          lang,
          "Calibration: predicted probability against observed frequency",
          "Calibração: probabilidade prevista contra frequência observada",
        )}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(0)} x2={x(1)} y1={y(t)} y2={y(t)} stroke="var(--line)" />
            <line x1={x(t)} x2={x(t)} y1={y(0)} y2={y(1)} stroke="var(--line)" />
            <text x={x(0) - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--ink-3)] text-[11px]">
              {pct(t)}
            </text>
            <text x={x(t)} y={y(0) + 16} textAnchor="middle" className="tnum fill-[var(--ink-3)] text-[11px]">
              {pct(t)}
            </text>
          </g>
        ))}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-3)" strokeWidth={1} />
        <text x={x(0.72) + 6} y={y(0.72) + 14} textAnchor="start" className="fill-[var(--ink-3)] text-[11px]">
          {tr(lang, "perfect", "perfeito")}
        </text>
        <path d={line} pathLength={1} className="draw-line" fill="none" stroke="var(--home)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {bins.map((b, i) => (
          <g key={b.bin}>
            <circle
              cx={x(b.predicted)}
              cy={y(b.observed)}
              r={hover === i ? 6 : 4.5}
              fill="var(--home)"
              stroke="var(--surface)"
              strokeWidth={2}
            />
            <circle
              cx={x(b.predicted)}
              cy={y(b.observed)}
              r={14}
              fill="transparent"
              tabIndex={0}
              aria-label={`${pct(b.predicted)}: ${pct(b.observed)} (${b.n})`}
              onPointerEnter={() => setHover(i)}
              onPointerLeave={() => setHover(null)}
              onFocus={() => setHover(i)}
              onBlur={() => setHover(null)}
            />
          </g>
        ))}
        <text x={x(0.5)} y={height - 2} textAnchor="middle" className="fill-[var(--ink-2)] text-[11px]">
          {tr(lang, "Predicted probability", "Probabilidade prevista")}
        </text>
      </svg>
      {active && (
        <div
          className="pointer-events-none absolute z-10 w-max rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(x(active.predicted) + 10, size - 150), top: Math.max(0, y(active.observed) - 60) }}
        >
          <div>
            <strong className="tnum font-semibold">{pct(active.observed)}</strong>{" "}
            <span className="text-ink-2">{tr(lang, "happened", "aconteceu")}</span>
          </div>
          <div className="tnum text-ink-2">
            {tr(lang, "when the model said", "quando o modelo disse")} {pct(active.predicted)} ({int(active.n)})
          </div>
        </div>
      )}
      <p className="mt-1 text-xs text-ink-2">
        {tr(
          lang,
          "Observed frequency (vertical) against the model's probability (horizontal).",
          "Frequência observada (vertical) contra a probabilidade do modelo (horizontal).",
        )}
      </p>
    </div>
  );
}
