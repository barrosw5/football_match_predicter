import { competitionLabel, formatDate, T } from "@/lib/i18n";
import type { FormGame } from "@/lib/types";

export const RESULT_PT = { W: "V", D: "E", L: "D" } as const;
const RESULT_WORD = {
  W: { en: "win", pt: "vitória" },
  D: { en: "draw", pt: "empate" },
  L: { en: "loss", pt: "derrota" },
} as const;

const OUTLINE: Record<FormGame["result"], string> = {
  W: "border-line bg-surface text-good-ink",
  D: "border-line bg-surface text-ink-3",
  L: "border-line bg-surface text-bad-ink",
};
// The most recent match is filled, so the reading direction is obvious at a glance.
const FILLED: Record<FormGame["result"], string> = {
  W: "border-transparent bg-[var(--good)] text-white",
  D: "border-transparent bg-[var(--ink-3)] text-white",
  L: "border-transparent bg-[var(--bad)] text-white",
};

const noon = (date: string) => `${date}T12:00:00Z`;

/** Text description of a match, e.g. "24 Nov · away vs Molde · 4-2 win". */
function describe(g: FormGame, lang: "en" | "pt"): string {
  const day = formatDate(noon(g.date), "dayMonth", lang);
  const venue = lang === "pt" ? (g.home ? "casa" : "fora") : g.home ? "home" : "away";
  const word = RESULT_WORD[g.result][lang];
  return `${day} · ${venue} vs ${g.opponent} · ${g.goalsFor}-${g.goalsAgainst} ${word}`;
}

/**
 * Last results as letters, oldest on the left and the latest (filled) on the right.
 * Hovering a letter shows the match: date, venue, opponent and score.
 */
export function FormPills({ games }: { games?: FormGame[] }) {
  if (!games || games.length === 0)
    return (
      <span className="text-xs text-ink-3">
        <T en="no recent games" pt="sem jogos recentes" />
      </span>
    );
  return (
    <span className="inline-flex items-center gap-0.5">
      {games.map((g, i) => {
        const latest = i === games.length - 1;
        return (
          <span key={`${g.date}-${i}`} className="group relative">
            <span
              aria-label={describe(g, "en")}
              className={`inline-flex h-4 w-4 items-center justify-center rounded-[3px] border text-[10px] font-semibold ${
                latest ? FILLED[g.result] : OUTLINE[g.result]
              }`}
            >
              <T en={g.result} pt={RESULT_PT[g.result]} />
            </span>
            <FormTooltip game={g} latest={latest} />
          </span>
        );
      })}
    </span>
  );
}

function FormTooltip({ game: g, latest }: { game: FormGame; latest: boolean }) {
  return (
    <span
      role="tooltip"
      className="pop-in pointer-events-none absolute bottom-full right-0 z-30 mb-1.5 hidden w-max max-w-64 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-left text-xs font-normal shadow-md group-hover:block"
    >
      <span className="block text-ink-3">
        <T
          en={`${formatDate(noon(g.date), "short", "en")} · ${competitionLabel(g.competition, "en")}`}
          pt={`${formatDate(noon(g.date), "short", "pt")} · ${competitionLabel(g.competition, "pt")}`}
        />
        {latest && (
          <>
            {" · "}
            <T en="latest" pt="mais recente" />
          </>
        )}
      </span>
      <span className="tnum block text-ink">
        <span className="font-semibold">
          {g.goalsFor}–{g.goalsAgainst}
        </span>{" "}
        <T en={RESULT_WORD[g.result].en} pt={RESULT_WORD[g.result].pt} />{" "}
        <span className="text-ink-2">
          <T en={g.home ? "at home vs" : "away at"} pt={g.home ? "em casa vs" : "fora vs"} /> {g.opponent}
        </span>
      </span>
    </span>
  );
}
