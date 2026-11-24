import Link from "next/link";

import { formatTime, num, pct } from "@/lib/format";
import { OutcomeName, T } from "@/lib/i18n";
import type { Fixture, Team } from "@/lib/types";

import { CompetitionTag } from "./badges";
import { FormPills } from "./form-pills";
import { ProbabilityBar } from "./probability-bar";
import { TeamLogo } from "./team-logo";

export function FixtureRow({ fixture }: { fixture: Fixture }) {
  const f = fixture;
  const likely = `${Math.floor(f.xg.home)}–${Math.floor(f.xg.away)}`;
  const pickProb = f.pick === "H" ? f.probs.home : f.pick === "D" ? f.probs.draw : f.probs.away;
  return (
    <li className="group/row">
      <Link
        href={`/match/${f.id}/`}
        className="grid grid-cols-[3.25rem_minmax(0,1fr)] gap-x-3 group-first/row:rounded-t-xl group-last/row:rounded-b-xl gap-y-3 px-4 py-3.5 transition-colors hover:bg-surface-2 md:grid-cols-[3.25rem_minmax(0,1.3fr)_minmax(0,1fr)_7rem] md:items-center"
      >
        <div className="tnum pt-0.5 text-sm text-ink-2 md:pt-0">
          {f.status === "awaiting_result" ? (
            <span className="text-xs text-ink-3">
              <T en="played" pt="jogado" />
            </span>
          ) : (
            formatTime(f.kickoff)
          )}
        </div>

        <div className="min-w-0">
          <div className="mb-1.5">
            <CompetitionTag competition={f.competition} />
          </div>
          <TeamLine team={f.home} bold={f.pick === "H"} />
          <TeamLine team={f.away} bold={f.pick === "A"} />
        </div>

        <div className="col-start-2 md:col-start-auto">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="shrink-0 text-xs text-ink-3">
              <T en="Prediction" pt="Previsão" />
            </span>
            <span className="tnum min-w-0 truncate">
              <span className="font-medium">
                <OutcomeName outcome={f.pick} home={f.home.name} away={f.away.name} />
              </span>{" "}
              <span className="text-ink-2">{pct(pickProb)}</span>
            </span>
          </div>
          <ProbabilityBar probs={f.probs} pick={f.pick} />
          {f.market && (
            <div className="tnum mt-1.5 flex items-baseline justify-between gap-2 text-xs text-ink-2">
              <span className="shrink-0 text-ink-3">
                <T en="Bookmakers" pt="Casas de apostas" />
              </span>
              <span className="min-w-0 truncate">
                <OutcomeName outcome={f.market.pick} home={f.home.name} away={f.away.name} />{" "}
                {pct(f.market.probs[f.market.pick === "H" ? "home" : f.market.pick === "D" ? "draw" : "away"])}
                {f.market.pick !== f.pick && (
                  <span className="ml-1.5 rounded border border-line px-1 text-[10px] text-ink">
                    <T en="disagree" pt="discordam" />
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="tnum col-start-2 flex items-baseline gap-4 text-sm md:col-start-auto md:flex-col md:items-end md:gap-0.5">
          <span className="text-xs text-ink-3">
            <T en="Likely score" pt="Resultado provável" />
          </span>
          <span className="font-semibold">{likely}</span>
          <span className="text-xs text-ink-2">
            xG {num(f.xg.home, 1)} – {num(f.xg.away, 1)}
          </span>
        </div>
      </Link>
    </li>
  );
}

function TeamLine({ team, bold }: { team: Team; bold: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 py-0.5 leading-6">
      <span className="flex min-w-0 items-center gap-2">
        <TeamLogo id={team.logo} name={team.name} size={20} />
        <span className={`truncate ${bold ? "font-semibold" : ""}`}>{team.name}</span>
      </span>
      <span className="hidden shrink-0 sm:inline-flex">
        <FormPills games={team.form} />
      </span>
    </div>
  );
}
