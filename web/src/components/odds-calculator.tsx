"use client";

import { useState } from "react";

import { pct, signed } from "@/lib/format";
import { T } from "@/lib/i18n";
import type { Odds, Probs } from "@/lib/types";

const ROWS = [
  { key: "home", label: "1" },
  { key: "draw", label: "X" },
  { key: "away", label: "2" },
] as const;

/**
 * Expected value of a 1-unit stake at the reader's own bookmaker odds:
 * EV = model probability x decimal odds - 1.
 */
export function OddsCalculator({ probs, odds, names }: { probs: Probs; odds: Odds | null; names: [string, string] }) {
  const [values, setValues] = useState<Record<string, string>>({
    home: odds ? String(odds.home) : "",
    draw: odds ? String(odds.draw) : "",
    away: odds ? String(odds.away) : "",
  });

  return (
    <div>
      <div className="grid grid-cols-[1fr_6rem_5rem] items-center gap-x-3 gap-y-2 text-sm">
        <span className="text-xs text-ink-3">
          <T en="Outcome" pt="Resultado" />
        </span>
        <span className="text-xs text-ink-3">
          <T en="Your odds" pt="As tuas odds" />
        </span>
        <span className="text-right text-xs text-ink-3">
          <T en="Exp. value" pt="Valor esperado" />
        </span>
        {ROWS.map(({ key, label }) => {
          const o = Number.parseFloat(values[key].replace(",", "."));
          const valid = Number.isFinite(o) && o > 1;
          const ev = valid ? probs[key] * o - 1 : null;
          return (
            <div key={key} className="contents">
              <label htmlFor={`odds-${key}`} className="truncate">
                <span className="tnum mr-2 text-ink-3">{label}</span>
                {key === "home" ? names[0] : key === "away" ? names[1] : <T en="Draw" pt="Empate" />}
              </label>
              <input
                id={`odds-${key}`}
                inputMode="decimal"
                value={values[key]}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
                placeholder="2.10"
                className="tnum w-full rounded-md border border-line bg-surface px-2 py-1.5 text-right"
              />
              <span
                className={`tnum text-right font-medium ${ev === null ? "text-ink-3" : ev > 0 ? "text-good-ink" : "text-ink-2"}`}
              >
                {ev === null ? "–" : signed(ev * 100, 1, "%")}
              </span>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-xs leading-5 text-ink-2">
        <T
          en="Positive values mean the odds pay more than the model thinks the outcome is worth. Break-even odds:"
          pt="Valores positivos significam que as odds pagam mais do que o modelo acha que o resultado vale. Odds mínimas para compensar:"
        />{" "}
        <span className="tnum">{ROWS.map(({ key }) => (1 / probs[key]).toFixed(2)).join(" / ")}</span> (
        <T en="model" pt="modelo" /> {ROWS.map(({ key }) => pct(probs[key])).join(" / ")}).
      </p>
    </div>
  );
}
