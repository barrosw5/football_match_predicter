"use client";

import { useState } from "react";

import { pct } from "@/lib/format";
import { formatDate, tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

import { useWidth } from "./use-width";

type Day = { date: string; n: number; correct: number };

const HEIGHT = 220;
const M = { top: 12, right: 8, bottom: 26, left: 32 };

const noon = (date: string) => `${date}T12:00:00Z`;

const monthLabel = (date: string, lang: "en" | "pt", long = false) =>
  new Date(noon(date)).toLocaleDateString(lang === "pt" ? "pt-PT" : "en-GB", {
    month: long ? "long" : "short",
    year: long ? "numeric" : "2-digit",
    timeZone: "UTC",
  });

/** Stacked columns per day (or per month): correct picks (bottom) and missed picks, 2px surface gap between. */
export function DailyChart({ days, unit = "day" }: { days: Day[]; unit?: "day" | "month" }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const lang = useLang();

  if (days.length === 0)
    return (
      <p className="text-sm text-ink-2">
        {tr(lang, "No settled matches in this period.", "Sem jogos avaliados neste período.")}
      </p>
    );

  const innerW = width - M.left - M.right;
  const innerH = HEIGHT - M.top - M.bottom;
  const maxN = Math.max(...days.map((d) => d.n));
  const yMax = niceMax(maxN);
  const ticks = [0, yMax / 2, yMax];
  const band = innerW / days.length;
  const barW = Math.max(2, Math.min(24, band * 0.7));
  const y = (v: number) => M.top + innerH - (v / yMax) * innerH;
  const labelEvery = Math.ceil(days.length / Math.max(1, Math.floor(innerW / 70)));
  const active = hover !== null ? days[hover] : null;

  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={HEIGHT}
        role="img"
        aria-label={
          unit === "month"
            ? tr(lang, "Correct and missed predictions per month", "Previsões certas e erradas por mês")
            : tr(lang, "Correct and missed predictions per day", "Previsões certas e erradas por dia")
        }
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
            <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--ink-3)] text-[11px]">
              {t}
            </text>
          </g>
        ))}
        {days.map((d, i) => {
          const cx = M.left + band * i + band / 2;
          const x = cx - barW / 2;
          const yCorrect = y(d.correct);
          const yTotal = y(d.n);
          const missed = d.n - d.correct;
          const dim = hover !== null && hover !== i;
          return (
            <g key={d.date} opacity={dim ? 0.45 : 1}>
              <g className="grow-y" style={{ animationDelay: `${i * 12}ms` }}>
                {d.correct > 0 && (
                  <path d={columnPath(x, yCorrect, barW, y(0) - yCorrect, missed === 0)} fill="var(--good)" />
                )}
                {missed > 0 && (
                  <path
                    d={columnPath(x, yTotal, barW, Math.max(0, yCorrect - yTotal - (d.correct > 0 ? 2 : 0)), true)}
                    fill="var(--bad)"
                  />
                )}
              </g>
              {i % labelEvery === 0 && (
                <text x={cx} y={HEIGHT - 8} textAnchor="middle" className="fill-[var(--ink-3)] text-[11px]">
                  {unit === "month" ? monthLabel(d.date, lang) : formatDate(noon(d.date), "dayMonth", lang)}
                </text>
              )}
              <rect
                x={M.left + band * i}
                y={M.top}
                width={band}
                height={innerH}
                fill="transparent"
                tabIndex={0}
                aria-label={`${unit === "month" ? monthLabel(d.date, lang, true) : formatDate(noon(d.date), "short", lang)}: ${d.correct} / ${d.n}`}
                onPointerEnter={() => setHover(i)}
                onPointerLeave={() => setHover(null)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
              />
            </g>
          );
        })}
      </svg>
      {active && hover !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max rounded-lg border border-line bg-surface px-3 py-2 text-xs shadow-sm"
          style={{ left: Math.min(Math.max(0, M.left + band * hover + band / 2 - 70), width - 150) }}
        >
          <div className="text-ink-2">
            {unit === "month" ? monthLabel(active.date, lang, true) : formatDate(noon(active.date), "short", lang)}
          </div>
          <div className="tnum mt-1 flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 bg-[var(--good)]" />
            <strong className="font-semibold">{active.correct}</strong>{" "}
            <span className="text-ink-2">{tr(lang, "correct", "certos")}</span>
          </div>
          <div className="tnum flex items-center gap-2">
            <span className="inline-block h-0.5 w-3 bg-[var(--bad)]" />
            <strong className="font-semibold">{active.n - active.correct}</strong>{" "}
            <span className="text-ink-2">{tr(lang, "missed", "errados")}</span>
          </div>
          <div className="tnum mt-1 text-ink-2">
            {pct(active.correct / active.n)} {tr(lang, "accuracy", "de acerto")}
          </div>
        </div>
      )}
    </div>
  );
}

/** Column with 4px rounded data-end (top) and a square base. */
function columnPath(x: number, top: number, w: number, h: number, roundTop: boolean): string {
  if (h <= 0) return "";
  const r = roundTop ? Math.min(4, w / 2, h) : 0;
  return `M${x},${top + h} V${top + r} Q${x},${top} ${x + r},${top} H${x + w - r} Q${x + w},${top} ${x + w},${top + r} V${top + h} Z`;
}

function niceMax(v: number): number {
  if (v <= 10) return 10;
  const step = v <= 50 ? 10 : v <= 200 ? 50 : v <= 1000 ? 100 : 500;
  return Math.ceil(v / step) * step;
}
