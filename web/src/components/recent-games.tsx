import { competitionLabel, LocalDate, T } from "@/lib/i18n";
import type { FormGame } from "@/lib/types";

import { RESULT_PT } from "./form-pills";
import { TeamLogo } from "./team-logo";

const BADGE: Record<FormGame["result"], string> = {
  W: "bg-[var(--good)] text-white",
  D: "bg-[var(--ink-3)] text-white",
  L: "bg-[var(--bad)] text-white",
};

/** A team's last matches before this one, most recent first. */
export function RecentGames({ team, logo, games }: { team: string; logo?: string | null; games?: FormGame[] }) {
  const list = [...(games ?? [])].reverse();
  const points = list.reduce((sum, g) => sum + (g.result === "W" ? 3 : g.result === "D" ? 1 : 0), 0);
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 font-medium">
          <TeamLogo id={logo} name={team} size={20} />
          <span className="truncate">{team}</span>
        </span>
        {list.length > 0 && (
          <span className="tnum shrink-0 text-xs text-ink-2">
            <T en={`${points} of ${list.length * 3} points`} pt={`${points} de ${list.length * 3} pontos`} />
          </span>
        )}
      </div>
      {list.length === 0 ? (
        <p className="text-sm text-ink-3">
          <T en="No previous matches in the data." pt="Sem jogos anteriores nos dados." />
        </p>
      ) : (
        <ol className="divide-y divide-line rounded-xl border border-line">
          {list.map((g, i) => (
            <li
              key={`${g.date}-${i}`}
              className="grid grid-cols-[4.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="text-xs leading-4 text-ink-2">
                <LocalDate iso={`${g.date}T12:00:00Z`} kind="dayMonth" />
                {i === 0 && (
                  <span className="block text-[10px] text-ink-3">
                    <T en="latest" pt="mais recente" />
                  </span>
                )}
              </span>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-1.5">
                  <span className="shrink-0 text-xs text-ink-3">
                    <T en={g.home ? "vs" : "at"} pt={g.home ? "vs" : "em"} />
                  </span>
                  <TeamLogo id={g.opponentLogo} name={g.opponent} size={16} />
                  <span className="truncate">{g.opponent}</span>
                </span>
                <span className="block truncate text-xs text-ink-3">
                  <T
                    en={`${competitionLabel(g.competition, "en")} · ${g.home ? "home" : "away"}`}
                    pt={`${competitionLabel(g.competition, "pt")} · ${g.home ? "casa" : "fora"}`}
                  />
                </span>
              </span>
              <span className="flex items-center gap-2">
                <span className="tnum font-semibold">
                  {g.goalsFor}–{g.goalsAgainst}
                </span>
                <span
                  className={`inline-flex h-5 w-5 items-center justify-center rounded-[4px] text-[11px] font-semibold ${BADGE[g.result]}`}
                >
                  <T en={g.result} pt={RESULT_PT[g.result]} />
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
