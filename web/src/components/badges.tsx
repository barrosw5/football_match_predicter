import { competitionName, countryName, T } from "@/lib/i18n";

import { CompetitionLogo } from "./competition-picker";
import type { Competition } from "@/lib/types";

export function CompetitionTag({ competition, full = false }: { competition: Competition; full?: boolean }) {
  const label = (lang: "en" | "pt") => {
    const name = competitionName(competition.code, competition.name, lang);
    return full ? `${name} · ${countryName(competition.country, lang)}` : name;
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-line bg-surface-2 px-1.5 py-0.5 text-[11px] font-medium leading-4 text-ink-2">
      {competition.logo && <CompetitionLogo src={competition.logo} size={14} />}
      <T en={label("en")} pt={label("pt")} />
    </span>
  );
}

export function SourceTag({ source }: { source: "live" | "backtest" }) {
  if (source === "live") return null;
  return (
    <span className="rounded border border-dashed border-line px-1 text-[10px] leading-4 text-ink-3">
      <T en="backtest" pt="simulação" />
    </span>
  );
}

export function Verdict({ correct }: { correct: boolean }) {
  return correct ? (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-good-ink">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path
          d="M2.5 6.2 5 8.6l4.5-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <T en="Correct" pt="Certo" />
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-bad-ink">
      <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
        <path d="m3 3 6 6M9 3 3 9" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
      <T en="Missed" pt="Errado" />
    </span>
  );
}
