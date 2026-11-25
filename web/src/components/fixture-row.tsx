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
  const when =
    f.status === "awaiting_result" ? (
      <span className="text-xs text-ink-3">
        <T en="played" pt="jogado" />
      </span>
    ) : (
      formatTime(f.kickoff)
    );
  return (
    <li className="group/row">
      <Link
        href={`/match/${f.id}/`}
        className="grid grid-cols-1 gap-y-3 px-4 py-3.5 transition-colors group-first/row:rounded-t-xl group-last/row:rounded-b-xl hover:bg-surface-2 active:bg-surface-2 md:grid-cols-[3.25rem_minmax(0,1.3fr)_minmax(0,1fr)_7rem] md:items-center md:gap-x-3"
      >
        <div className="tnum hidden text-sm text-ink-2 md:block">{when}</div>

        <div className="min-w-0">
          <div className="mb-1.5 flex items-center justify-between gap-3">
            <CompetitionTag competition={f.competition} />
            <span className="tnum shrink-0 text-sm text-ink-2 md:hidden">{when}</span>
          </div>
          <TeamLine team={f.home} bold={f.pick === "H"} />
          <TeamLine team={f.away} bold={f.pick === "A"} />
        </div>

        <div className="min-w-0">
          <div className="mb-1.5 flex items-baseline justify-between gap-2 text-sm">
            <span className="shrink-0 text-xs text-ink-3">
              <T en="Prediction" pt="Previsão" />
            </span>
            <span className="tnum min-w-0 truncate">
              <span className="font-medium">
                <OutcomeName outcome={f.pick} home={f.home.name} away={f.away.name} homeLogo={f.home.logo} awayLogo={f.away.logo} />
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
              <span className="flex min-w-0 items-baseline gap-1.5">
                <span className="min-w-0 truncate">
                  <OutcomeName outcome={f.market.pick} home={f.home.name} away={f.away.name} homeLogo={f.home.logo} awayLogo={f.away.logo} />{" "}
                  {pct(f.market.probs[f.market.pick === "H" ? "home" : f.market.pick === "D" ? "draw" : "away"])}
                </span>
                {f.market.pick !== f.pick && (
                  <span className="shrink-0 rounded border border-line px-1 text-[10px] text-ink">
                    <T en="disagree" pt="discordam" />
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="tnum flex items-baseline gap-4 text-sm md:flex-col md:items-end md:gap-0.5">
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
      <span className="inline-flex shrink-0">
        <FormPills games={team.form} />
      </span>
    </div>
  );
}
