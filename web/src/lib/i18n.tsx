import type { ReactNode } from "react";

import { TeamLogo } from "@/components/team-logo";

/*
 * Bilingual (English / Portuguese) static site.
 *
 * Every page is pre-rendered once, with both languages in the HTML: <T> outputs an English
 * and a Portuguese span and CSS hides the inactive one (see globals.css). An inline script
 * in <head> picks the language before the first paint (saved choice, else the browser's
 * language), so there is no flash of the wrong language and no second set of pages.
 * Strings that cannot hold markup (placeholders, <option>, SVG text) use `useLang()`.
 */

export type Lang = "en" | "pt";

export function T({ en, pt }: { en: ReactNode; pt: ReactNode }) {
  return (
    <>
      <span className="i18n-en" lang="en">
        {en}
      </span>
      <span className="i18n-pt" lang="pt">
        {pt}
      </span>
    </>
  );
}

/** Block-level variant (for content that contains paragraphs, lists or divs). */
export function TBlock({ en, pt, className }: { en: ReactNode; pt: ReactNode; className?: string }) {
  return (
    <>
      <div className={`i18n-en ${className ?? ""}`} lang="en">
        {en}
      </div>
      <div className={`i18n-pt ${className ?? ""}`} lang="pt">
        {pt}
      </div>
    </>
  );
}

export function tr(lang: Lang, en: string, pt: string): string {
  return lang === "pt" ? pt : en;
}

// ---------------------------------------------------------------- competitions

const COUNTRY_PT: Record<string, string> = {
  England: "Inglaterra",
  Spain: "Espanha",
  Germany: "Alemanha",
  Italy: "Itália",
  France: "França",
  Portugal: "Portugal",
  Netherlands: "Países Baixos",
  Belgium: "Bélgica",
  Turkey: "Turquia",
  Greece: "Grécia",
  Scotland: "Escócia",
  Austria: "Áustria",
  Switzerland: "Suíça",
  Denmark: "Dinamarca",
  Norway: "Noruega",
  Sweden: "Suécia",
  Europe: "Europa",
};

const COMPETITION_PT: Record<string, string> = {
  CL: "Liga dos Campeões",
  EL: "Liga Europa",
  ECL: "Liga Conferência",
  PTC: "Taça de Portugal",
  FAC: "Taça de Inglaterra (FA Cup)",
  EFLC: "Taça da Liga inglesa",
  CDR: "Taça do Rei",
  DFBP: "Taça da Alemanha",
  CI: "Taça de Itália",
  CDF: "Taça de França",
  KNVB: "Taça dos Países Baixos",
  SCC: "Taça da Escócia",
  SLC: "Taça da Liga escocesa",
};

export function competitionName(code: string, name: string, lang: Lang): string {
  return lang === "pt" ? (COMPETITION_PT[code] ?? name) : name;
}

// Same codes as football_predictor/config.py
const COMPETITION_EN: Record<string, string> = {
  E0: "Premier League",
  E1: "Championship",
  SP1: "La Liga",
  SP2: "La Liga 2",
  D1: "Bundesliga",
  D2: "2. Bundesliga",
  I1: "Serie A",
  I2: "Serie B",
  F1: "Ligue 1",
  F2: "Ligue 2",
  P1: "Primeira Liga",
  N1: "Eredivisie",
  B1: "Pro League",
  T1: "Süper Lig",
  G1: "Super League (GRE)",
  SC0: "Premiership",
  AUT: "Bundesliga (AUT)",
  SWZ: "Super League (SUI)",
  DNK: "Superliga",
  NOR: "Eliteserien",
  SWE: "Allsvenskan",
  CL: "Champions League",
  EL: "Europa League",
  ECL: "Conference League",
  PTC: "Taça de Portugal",
  FAC: "FA Cup",
  EFLC: "EFL Cup",
  CDR: "Copa del Rey",
  DFBP: "DFB-Pokal",
  CI: "Coppa Italia",
  CDF: "Coupe de France",
  KNVB: "KNVB Cup",
  SCC: "Scottish Cup",
  SLC: "Scottish League Cup",
};

/** Competition name from its code alone (for match lists that only carry the code). */
export function competitionLabel(code: string, lang: Lang): string {
  return competitionName(code, COMPETITION_EN[code] ?? code, lang);
}

export function countryName(country: string, lang: Lang): string {
  return lang === "pt" ? (COUNTRY_PT[country] ?? country) : country;
}

// ---------------------------------------------------------------- dates

// Lisbon time (= UK time): deterministic at build time and local to most covered leagues.
const TZ = "Europe/Lisbon";
const LOCALE: Record<Lang, string> = { en: "en-GB", pt: "pt-PT" };

const formatters = {
  day: { weekday: "long", day: "numeric", month: "long", timeZone: TZ },
  short: { weekday: "short", day: "numeric", month: "short", timeZone: TZ },
  dayMonth: { day: "numeric", month: "short", timeZone: TZ },
  stamp: { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ, timeZoneName: "short" },
} satisfies Record<string, Intl.DateTimeFormatOptions>;

export type DateKind = keyof typeof formatters;

export function formatDate(iso: string, kind: DateKind, lang: Lang): string {
  if (!iso) return "–";
  const text = new Intl.DateTimeFormat(LOCALE[lang], formatters[kind]).format(new Date(iso));
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** A date rendered in both languages. */
export function LocalDate({ iso, kind }: { iso: string; kind: DateKind }) {
  return <T en={formatDate(iso, kind, "en")} pt={formatDate(iso, kind, "pt")} />;
}

// ---------------------------------------------------------------- outcomes

/** "Benfica win" / "Benfica vence", or "Draw" / "Empate". */
export function OutcomeName({
  outcome,
  home,
  away,
  homeLogo,
  awayLogo,
}: {
  outcome: "H" | "D" | "A";
  home: string;
  away: string;
  /** ESPN ids: when given, the winner's crest is shown before the name. */
  homeLogo?: string | null;
  awayLogo?: string | null;
}) {
  if (outcome === "D") return <T en="Draw" pt="Empate" />;
  const team = outcome === "H" ? home : away;
  const logo = outcome === "H" ? homeLogo : awayLogo;
  const text = <T en={`${team} win`} pt={`${team} vence`} />;
  if (logo === undefined) return text;
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 align-bottom">
      <TeamLogo id={logo} name={team} size={16} />
      <span className="truncate">{text}</span>
    </span>
  );
}

export function outcomeText(outcome: "H" | "D" | "A", home: string, away: string, lang: Lang): string {
  if (outcome === "D") return tr(lang, "Draw", "Empate");
  const team = outcome === "H" ? home : away;
  return tr(lang, `${team} win`, `${team} vence`);
}

/**
 * Runs in <head> before the first paint: picks the language (saved, else browser) and the
 * colour theme (saved, else OS setting), so neither flashes on load.
 */
export const LANG_BOOTSTRAP = `(function(){var d=document.documentElement;try{var l=localStorage.getItem("lang");if(l!=="en"&&l!=="pt"){l=(navigator.language||"").toLowerCase().indexOf("pt")===0?"pt":"en"}d.setAttribute("data-lang",l);d.setAttribute("lang",l==="pt"?"pt-PT":"en");var t=localStorage.getItem("theme");if(t!=="light"&&t!=="dark"){t=window.matchMedia&&window.matchMedia("(prefers-color-scheme: dark)").matches?"dark":"light"}d.setAttribute("data-theme",t)}catch(e){d.setAttribute("data-theme","light")}})();`;
