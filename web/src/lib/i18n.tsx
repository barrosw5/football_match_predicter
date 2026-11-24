import type { ReactNode } from "react";

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
};

export function competitionName(code: string, name: string, lang: Lang): string {
  return lang === "pt" ? (COMPETITION_PT[code] ?? name) : name;
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
export function OutcomeName({ outcome, home, away }: { outcome: "H" | "D" | "A"; home: string; away: string }) {
  if (outcome === "D") return <T en="Draw" pt="Empate" />;
  const team = outcome === "H" ? home : away;
  return <T en={`${team} win`} pt={`${team} vence`} />;
}

export function outcomeText(outcome: "H" | "D" | "A", home: string, away: string, lang: Lang): string {
  if (outcome === "D") return tr(lang, "Draw", "Empate");
  const team = outcome === "H" ? home : away;
  return tr(lang, `${team} win`, `${team} vence`);
}

export const LANG_BOOTSTRAP =`(function(){try{var l=localStorage.getItem("lang");if(l!=="en"&&l!=="pt"){l=(navigator.language||"").toLowerCase().indexOf("pt")===0?"pt":"en"}var d=document.documentElement;d.setAttribute("data-lang",l);d.setAttribute("lang",l==="pt"?"pt-PT":"en")}catch(e){}})();`;
