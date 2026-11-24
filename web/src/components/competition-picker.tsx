"use client";

import { useEffect, useRef, useState } from "react";

import { competitionLabel, countryName, tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

import { ThemedLogo } from "./team-logo";

export type PickerCompetition = { code: string; country: string; logo?: string | null };

export function CompetitionLogo({ src: raw, size = 16 }: { src?: string | null; size?: number }) {
  const src = raw?.replace(/^http:/, "https:");
  if (!src) return <span className="inline-block shrink-0" style={{ width: size, height: size }} aria-hidden="true" />;
  if (src.startsWith("https://a.espncdn.com/i/")) return <ThemedLogo path={src.slice("https://a.espncdn.com".length)} size={size} />;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, remote CDN image
    <img src={src} alt="" width={size} height={size} loading="lazy" className="shrink-0 object-contain" style={{ width: size, height: size }} />
  );
}

/** Competition filter with logos (a native <select> cannot show images). */
export function CompetitionPicker({
  competitions,
  value,
  onChange,
}: {
  competitions: PickerCompetition[];
  value: string;
  onChange: (code: string) => void;
}) {
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selected = competitions.find((c) => c.code === value);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const label = (c: PickerCompetition) => `${countryName(c.country, lang)} · ${competitionLabel(c.code, lang)}`;
  const pick = (code: string) => {
    onChange(code);
    setOpen(false);
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex min-w-52 items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-left text-sm"
      >
        {selected ? <CompetitionLogo src={selected.logo} /> : null}
        <span className="flex-1 truncate">{selected ? label(selected) : tr(lang, "Every competition", "Todas as competições")}</span>
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true" className={`text-ink-3 transition-transform ${open ? "rotate-180" : ""}`}>
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <ul role="listbox" className="pop-in absolute left-0 z-40 mt-1 max-h-80 w-72 overflow-y-auto rounded-lg border border-line bg-surface p-1 shadow-lg">
          <li>
            <button type="button" role="option" aria-selected={!value} onClick={() => pick("")} className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${!value ? "font-medium" : ""}`}>
              <span className="inline-block h-4 w-4" />
              {tr(lang, "Every competition", "Todas as competições")}
            </button>
          </li>
          {competitions.map((c) => (
            <li key={c.code}>
              <button
                type="button"
                role="option"
                aria-selected={c.code === value}
                onClick={() => pick(c.code)}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-surface-2 ${c.code === value ? "font-medium" : ""}`}
              >
                <CompetitionLogo src={c.logo} />
                <span className="truncate">{label(c)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
