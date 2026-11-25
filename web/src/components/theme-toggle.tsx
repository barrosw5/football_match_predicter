"use client";

import { useSyncExternalStore } from "react";

import { tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

type Theme = "light" | "dark";
const EVENT = "themechange";

const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
const subscribe = (cb: () => void) => {
  window.addEventListener(EVENT, cb);
  return () => window.removeEventListener(EVENT, cb);
};

function setTheme(theme: Theme) {
  // A short cross-fade between the two themes where the browser supports it.
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (document.startViewTransition && !reduce) document.startViewTransition(() => applyTheme(theme));
  else applyTheme(theme);
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  try {
    localStorage.setItem("theme", theme);
  } catch {
    // private mode: not remembered
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Light / dark switch. The initial theme comes from the bootstrap script in <head>. */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const lang = useLang();
  const next: Theme = theme === "dark" ? "light" : "dark";
  const label =
    next === "dark" ? tr(lang, "Switch to dark mode", "Mudar para modo escuro") : tr(lang, "Switch to light mode", "Mudar para modo claro");
  return (
    <button
      type="button"
      onClick={() => setTheme(next)}
      aria-label={label}
      title={label}
      className="inline-flex h-9 w-9 items-center lg:h-7 lg:w-7 justify-center rounded-md border border-line text-ink-2 transition-colors hover:text-ink"
    >
      {theme === "dark" ? (
        // sun: shown in dark mode, switches to light
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        // moon: shown in light mode, switches to dark
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7z" />
        </svg>
      )}
    </button>
  );
}
