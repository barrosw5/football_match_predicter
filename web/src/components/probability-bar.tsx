import type { ReactNode } from "react";

import { pct } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { Outcome, Probs } from "@/lib/types";

const SEGMENTS: { key: keyof Probs; outcome: Outcome; color: string; en: string; pt: string }[] = [
  { key: "home", outcome: "H", color: "var(--home)", en: "Home", pt: "Casa" },
  { key: "draw", outcome: "D", color: "var(--draw)", en: "Draw", pt: "Empate" },
  { key: "away", outcome: "A", color: "var(--away)", en: "Away", pt: "Fora" },
];

/**
 * One whole (100%) split into home / draw / away, with a 2px surface gap between the
 * segments. The numbers are always printed under the bar, so colour never carries the
 * meaning alone.
 */
export function ProbabilityBar({
  probs,
  pick,
  size = "sm",
  names,
  labels,
}: {
  probs: Probs;
  pick?: Outcome;
  size?: "sm" | "lg";
  /** Team names used as labels in the large variant. */
  names?: [string, string];
  /** Labels written before each percentage, e.g. win / draw / loss on a team page. */
  labels?: [ReactNode, ReactNode, ReactNode];
}) {
  const height = size === "lg" ? "h-3" : "h-2";
  const title = `${pct(probs.home)} / ${pct(probs.draw)} / ${pct(probs.away)}`;
  return (
    <div className="w-full">
      <div className={`flex ${height} w-full gap-0.5`} role="img" aria-label={title} title={title}>
        {SEGMENTS.map((s, i) => (
          <div
            key={s.key}
            className={`${i === 0 ? "rounded-l-[4px]" : ""} ${i === 2 ? "rounded-r-[4px]" : ""}`}
            style={{ width: `${probs[s.key] * 100}%`, background: s.color, minWidth: probs[s.key] > 0 ? 2 : 0 }}
          />
        ))}
      </div>
      <div className={`tnum mt-1.5 grid grid-cols-3 gap-2 ${size === "lg" ? "text-sm" : "text-xs"}`}>
        {SEGMENTS.map((s, i) => {
          const team = names && s.key !== "draw" ? names[s.key === "home" ? 0 : 1] : null;
          return (
            <span
              key={s.key}
              className={`min-w-0 truncate ${i === 1 ? "text-center" : i === 2 ? "text-right" : ""} ${
                pick === s.outcome ? "font-semibold text-ink" : "text-ink-2"
              }`}
            >
              {labels ? (
                <span className="font-normal text-ink-3">{labels[i]} </span>
              ) : (
                size === "lg" && <span className="font-normal text-ink-3">{team ?? <T en={s.en} pt={s.pt} />} </span>
              )}
              {pct(probs[s.key])}
            </span>
          );
        })}
      </div>
    </div>
  );
}

export function OutcomeLegend() {
  const items = [
    { en: "Home win", pt: "Vitória da casa", color: "var(--home)" },
    { en: "Draw", pt: "Empate", color: "var(--draw)" },
    { en: "Away win", pt: "Vitória de fora", color: "var(--away)" },
  ];
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-2">
      {items.map((it) => (
        <li key={it.en} className="flex items-center gap-1.5">
          <span className="inline-block h-2 w-3 rounded-[2px]" style={{ background: it.color }} aria-hidden="true" />
          <T en={it.en} pt={it.pt} />
        </li>
      ))}
    </ul>
  );
}
