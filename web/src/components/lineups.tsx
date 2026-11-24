import Link from "next/link";

import { LocalDate, T } from "@/lib/i18n";
import type { LastXI, LineupPlayer, MatchEvent, MatchSummary } from "@/lib/types";

import { Pitch } from "./pitch";

type TeamInfo = { name: string; logo?: string | null };

const EVENT_LABEL: Record<MatchEvent["type"], { en: string; pt: string }> = {
  goal: { en: "Goal", pt: "Golo" },
  penalty: { en: "Penalty goal", pt: "Golo de penálti" },
  own_goal: { en: "Own goal", pt: "Autogolo" },
  yellow: { en: "Yellow card", pt: "Cartão amarelo" },
  red: { en: "Red card", pt: "Cartão vermelho" },
  sub: { en: "Substitution", pt: "Substituição" },
};

function EventMark({ type }: { type: MatchEvent["type"] }) {
  if (type === "yellow") return <span className="h-3 w-2 shrink-0 rounded-[1px] bg-[#eda100]" aria-hidden="true" />;
  if (type === "red") return <span className="h-3 w-2 shrink-0 rounded-[1px] bg-[var(--bad)]" aria-hidden="true" />;
  return <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-ink" aria-hidden="true" />;
}

function PlayerLink({ p }: { p: LineupPlayer }) {
  return p.id ? (
    <Link href={`/player/?id=${p.id}`} className="truncate hover:underline">
      {p.name}
    </Link>
  ) : (
    <span className="truncate">{p.name}</span>
  );
}

function Bench({ team, players }: { team: TeamInfo; players: LineupPlayer[] }) {
  const used = players.filter((p) => !p.starter && p.subIn);
  const unused = players.filter((p) => !p.starter && !p.subIn);
  return (
    <div className="min-w-0 text-sm">
      <div className="mb-1 font-medium">{team.name}</div>
      {used.length > 0 && (
        <ul className="space-y-0.5">
          {used.map((p, i) => (
            <li key={`${p.name}-${i}`} className="flex items-center gap-2">
              <span className="tnum w-6 shrink-0 text-right text-xs text-ink-3">{p.jersey}</span>
              <PlayerLink p={p} />
              <span className="shrink-0 text-[10px] text-ink-3">
                <T en="came on" pt="entrou" />
              </span>
            </li>
          ))}
        </ul>
      )}
      {unused.length > 0 && (
        <p className="mt-1.5 text-xs leading-5 text-ink-3">
          <T en="Unused: " pt="Não utilizados: " />
          {unused.map((p) => p.name).join(", ")}
        </p>
      )}
    </div>
  );
}

/** Line-ups on the pitch, key events and substitutes of a finished match. */
export function MatchLineups({ summary, home, away }: { summary: MatchSummary; home: TeamInfo; away: TeamInfo }) {
  const keyEvents = summary.events.filter((e) => e.type !== "sub");
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Pitch
        home={{ ...home, formation: summary.formations.home, players: summary.lineups.home, events: summary.events }}
        away={{ ...away, formation: summary.formations.away, players: summary.lineups.away, events: summary.events }}
      />
      <div className="min-w-0">
        {keyEvents.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-medium">
              <T en="Key events" pt="Lances principais" />
            </h3>
            <ol className="mb-5 space-y-1.5 text-sm">
              {keyEvents.map((e, i) => (
                <li key={i} className="flex items-center gap-2">
                  <span className="tnum w-10 shrink-0 text-xs text-ink-3">{e.minute}</span>
                  <EventMark type={e.type} />
                  <span className="min-w-0">
                    <span className="font-medium">{e.player}</span>{" "}
                    <span className="text-xs text-ink-3">
                      <T en={EVENT_LABEL[e.type].en} pt={EVENT_LABEL[e.type].pt} /> · {e.side === "home" ? home.name : away.name}
                      {e.other && (e.type === "goal" || e.type === "penalty") && (
                        <>
                          {" · "}
                          <T en={`assist ${e.other}`} pt={`assistência ${e.other}`} />
                        </>
                      )}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          </>
        )}
        <h3 className="mb-2 text-sm font-medium">
          <T en="Substitutes" pt="Suplentes" />
        </h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
          <Bench team={home} players={summary.lineups.home} />
          <Bench team={away} players={summary.lineups.away} />
        </div>
      </div>
    </div>
  );
}

/** Each team's starting XI in its previous match: a hint, not the confirmed line-up. */
export function LastStartingXI({ home, away, data }: { home: TeamInfo; away: TeamInfo; data: { home?: LastXI; away?: LastXI } }) {
  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Pitch
        home={{ ...home, formation: data.home?.formation, players: data.home?.players ?? [] }}
        away={{ ...away, formation: data.away?.formation, players: data.away?.players ?? [] }}
      />
      <div className="space-y-3 text-sm text-ink-2">
        {(["home", "away"] as const).map((side) => {
          const team = side === "home" ? home : away;
          const xi = data[side];
          return (
            <p key={side}>
              <span className="font-medium text-ink">{team.name}</span>:{" "}
              {xi ? (
                <>
                  <T en="starting XI against" pt="onze inicial contra" /> {xi.opponent},{" "}
                  <LocalDate iso={`${xi.date}T12:00:00Z`} kind="dayMonth" />.
                </>
              ) : (
                <T en="no recent line-up available." pt="sem escalação recente disponível." />
              )}
            </p>
          );
        })}
      </div>
    </div>
  );
}
