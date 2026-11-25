import Link from "next/link";

import { T } from "@/lib/i18n";
import type { LineupPlayer, MatchEvent } from "@/lib/types";

import { TeamLogo } from "./team-logo";

type Side = {
  name: string;
  logo?: string | null;
  formation?: string | null;
  players: LineupPlayer[];
  events?: MatchEvent[];
};

/** How deep a position plays: 0 = goalkeeper ... 5 = centre-forward. */
function depth(pos: string | null | undefined): number {
  const base = (pos ?? "M").split("-")[0].toUpperCase();
  if (base === "G" || base === "GK") return 0;
  if (["D", "CD", "CB", "LB", "RB", "LWB", "RWB", "SW", "WB"].includes(base)) return 1;
  if (base === "DM") return 2;
  if (["M", "CM", "LM", "RM"].includes(base)) return 3;
  if (["AM", "LW", "RW", "W"].includes(base)) return 4;
  return 5; // F, CF, ST, ...
}

/** Left (-1) to right (+1), from the player's own point of view. */
function lateral(pos: string | null | undefined): number {
  const [base, side] = (pos ?? "").toUpperCase().split("-");
  if (side === "L") return -0.5;
  if (side === "R") return 0.5;
  if (base.startsWith("L")) return -1;
  if (base.startsWith("R")) return 1;
  return 0;
}

/** Starting XI arranged in lines (goalkeeper first), each line left to right. */
export function formationLines(players: LineupPlayer[], formation?: string | null): LineupPlayer[][] {
  const starters = players.filter((p) => p.starter);
  if (starters.length === 0) return [];
  const sorted = [...starters].sort((a, b) => depth(a.pos) - depth(b.pos) || (a.place ?? 99) - (b.place ?? 99));
  const [gk, ...outfield] = sorted;
  let counts = (formation ?? "")
    .split("-")
    .map((n) => Number.parseInt(n, 10))
    .filter((n) => n > 0);
  if (counts.reduce((a, b) => a + b, 0) !== outfield.length) {
    // no usable formation: group by position depth instead
    const groups = new Map<number, number>();
    outfield.forEach((p) => groups.set(depth(p.pos), (groups.get(depth(p.pos)) ?? 0) + 1));
    counts = [...groups.entries()].sort((a, b) => a[0] - b[0]).map(([, n]) => n);
  }
  const lines: LineupPlayer[][] = [[gk]];
  let i = 0;
  for (const n of counts) {
    lines.push(outfield.slice(i, i + n).sort((a, b) => lateral(a.pos) - lateral(b.pos)));
    i += n;
  }
  return lines;
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  return parts.length > 1 ? parts.slice(1).join(" ") : name;
}

function Marker({ p, events, side }: { p: LineupPlayer; events: MatchEvent[]; side: "home" | "away" }) {
  const mine = events.filter((e) => e.side === side && e.player === p.name);
  const goals = mine.filter((e) => e.type === "goal" || e.type === "penalty").length;
  const yellow = mine.some((e) => e.type === "yellow");
  const red = mine.some((e) => e.type === "red");
  const body = (
    <>
      <span
        className="relative flex h-8 w-8 items-center justify-center rounded-full border-2 text-xs font-semibold sm:h-9 sm:w-9"
        style={{
          background: side === "home" ? "var(--home)" : "var(--away)",
          borderColor: "var(--surface)",
          color: "#fff",
        }}
      >
        {p.jersey ?? ""}
        {goals > 0 && (
          <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full border border-line bg-surface px-0.5 text-[9px] text-ink">
            {goals > 1 ? goals : ""}
            <svg width="8" height="8" viewBox="0 0 8 8" aria-hidden="true">
              <circle cx="4" cy="4" r="3.5" fill="none" stroke="currentColor" />
              <path d="M4 1.8 5.6 3 5 4.9H3L2.4 3z" fill="currentColor" />
            </svg>
          </span>
        )}
        {(yellow || red) && (
          <span
            className="absolute -left-1 -top-0.5 h-3 w-2 rounded-[1px]"
            style={{ background: red ? "var(--bad)" : "#eda100" }}
            aria-hidden="true"
          />
        )}
        {p.subOut && (
          <span className="absolute -bottom-1 -right-1.5 rounded-full border border-line bg-surface px-0.5 text-[8px] leading-3 text-ink-2">
            <T en="off" pt="saiu" />
          </span>
        )}
      </span>
      <span className="mt-0.5 max-w-[4rem] truncate text-center text-[10px] leading-3 text-ink sm:max-w-[6rem] sm:text-[11px]">
        {shortName(p.name)}
      </span>
    </>
  );
  return p.id ? (
    <Link href={`/player/?id=${p.id}`} className="flex flex-col items-center hover:opacity-80" title={p.name}>
      {body}
    </Link>
  ) : (
    <span className="flex flex-col items-center" title={p.name}>
      {body}
    </span>
  );
}

function TeamBar({ side }: { side: Side }) {
  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
      <span className="flex min-w-0 items-center gap-2 font-medium">
        <TeamLogo id={side.logo} name={side.name} size={20} />
        <span className="truncate">{side.name}</span>
      </span>
      {side.formation && <span className="tnum text-xs text-ink-2">{side.formation}</span>}
    </div>
  );
}

/**
 * Both line-ups on one vertical pitch: away team at the top (attacking down), home team at
 * the bottom (attacking up). Each player is placed by position; numbers are shirt numbers.
 */
export function Pitch({ home, away }: { home: Side; away: Side }) {
  const homeLines = formationLines(home.players, home.formation);
  const awayLines = formationLines(away.players, away.formation);
  const events = [...(home.events ?? []), ...(away.events ?? [])];

  const place = (lines: LineupPlayer[][], side: "home" | "away") =>
    lines.flatMap((line, li) => {
      // rows from own goal (li = 0) towards the halfway line
      const y = side === "home" ? 94 - (li / Math.max(lines.length - 1, 1)) * 38 : 6 + (li / Math.max(lines.length - 1, 1)) * 38;
      return line.map((p, pi) => {
        const frac = (pi + 1) / (line.length + 1);
        const x = side === "home" ? frac * 100 : (1 - frac) * 100; // away team's left is the viewer's right
        return { p, x, y };
      });
    });

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <TeamBar side={away} />
      <div className="relative aspect-[0.6] w-full sm:aspect-[0.72]" style={{ background: "var(--pitch)" }}>
        <svg viewBox="0 0 72 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
          <g fill="none" stroke="var(--pitch-line)" strokeWidth="0.4">
            <rect x="2" y="1.5" width="68" height="97" />
            <line x1="2" y1="50" x2="70" y2="50" />
            <circle cx="36" cy="50" r="7" />
            <rect x="18" y="1.5" width="36" height="13" />
            <rect x="27" y="1.5" width="18" height="5" />
            <rect x="18" y="85.5" width="36" height="13" />
            <rect x="27" y="93.5" width="18" height="5" />
          </g>
        </svg>
        {place(awayLines, "away").map(({ p, x, y }, i) => (
          <div key={`a${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <Marker p={p} events={events} side="away" />
          </div>
        ))}
        {place(homeLines, "home").map(({ p, x, y }, i) => (
          <div key={`h${i}`} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }}>
            <Marker p={p} events={events} side="home" />
          </div>
        ))}
      </div>
      <TeamBar side={home} />
    </div>
  );
}
