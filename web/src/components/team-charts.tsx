import { formatDate, T } from "@/lib/i18n";

/** Rating after every match over the last year (single series: no legend needed). */
export function EloChart({ points }: { points: [string, number][] }) {
  if (points.length < 2)
    return (
      <p className="text-sm text-ink-3">
        <T en="Not enough matches in the last year." pt="Jogos insuficientes no último ano." />
      </p>
    );
  const W = 640;
  const H = 180;
  const M = { top: 10, right: 10, bottom: 22, left: 40 };
  const values = points.map((p) => p[1]);
  const min = Math.floor((Math.min(...values) - 10) / 25) * 25;
  const max = Math.ceil((Math.max(...values) + 10) / 25) * 25;
  const t0 = Date.parse(points[0][0]);
  const t1 = Date.parse(points[points.length - 1][0]);
  const x = (d: string) => M.left + ((Date.parse(d) - t0) / Math.max(t1 - t0, 1)) * (W - M.left - M.right);
  const y = (v: number) => M.top + (1 - (v - min) / (max - min)) * (H - M.top - M.bottom);
  const path = points.map(([d, v], i) => `${i ? "L" : "M"}${x(d).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const ticks = [min, (min + max) / 2, max];
  const dateTicks = [0, Math.floor(points.length / 2), points.length - 1].map((i) => points[i][0]);
  const last = points[points.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Elo over the last year">
      {ticks.map((t) => (
        <g key={t}>
          <line x1={M.left} x2={W - M.right} y1={y(t)} y2={y(t)} stroke="var(--line)" />
          <text x={M.left - 6} y={y(t)} dy="0.32em" textAnchor="end" className="tnum fill-[var(--ink-3)] text-[11px]">
            {Math.round(t)}
          </text>
        </g>
      ))}
      {dateTicks.map((d, i) => (
        <text
          key={`${d}-${i}`}
          x={x(d)}
          y={H - 6}
          textAnchor={i === 0 ? "start" : i === 2 ? "end" : "middle"}
          className="fill-[var(--ink-3)] text-[11px]"
        >
          <tspan className="i18n-en">{formatDate(`${d}T12:00:00Z`, "dayMonth", "en")}</tspan>
          <tspan className="i18n-pt">{formatDate(`${d}T12:00:00Z`, "dayMonth", "pt")}</tspan>
        </text>
      ))}
      <path d={path} pathLength={1} className="draw-line" fill="none" stroke="var(--home)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle className="fade-in [animation-delay:900ms]" cx={x(last[0])} cy={y(last[1])} r="4.5" fill="var(--home)" stroke="var(--surface)" strokeWidth="2" />
      <text x={x(last[0]) - 8} y={y(last[1]) - 10} textAnchor="end" className="tnum fill-[var(--ink)] text-[12px] font-semibold">
        {Math.round(last[1])}
      </text>
    </svg>
  );
}

/** Squad value snapshots (EUR millions) as columns, value on the last one. */
export function ValueChart({ history }: { history: { date: string; value: number }[] }) {
  if (history.length === 0)
    return (
      <p className="text-sm text-ink-3">
        <T en="No market value data for this club." pt="Sem dados de valor de mercado para este clube." />
      </p>
    );
  const max = Math.max(...history.map((h) => h.value)) || 1;
  return (
    <div>
      <div className="flex h-28 items-end gap-0.5">
        {history.map((h, i) => (
          <div key={h.date} className="group relative flex h-full flex-1 items-end" title={`${h.date}: ${Math.round(h.value)} M€`}>
            <div
              className="grow-y w-full rounded-t-[4px]"
              style={{ height: `${(h.value / max) * 100}%`, background: i === history.length - 1 ? "var(--home)" : "var(--seq-2)" }}
            />
          </div>
        ))}
      </div>
      <div className="tnum mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{history[0].date.slice(0, 7)}</span>
        <span>{history[history.length - 1].date.slice(0, 7)}</span>
      </div>
    </div>
  );
}
