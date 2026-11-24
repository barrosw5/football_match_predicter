"use client";

import { setLang, useLang } from "@/lib/use-lang";

export function LanguageToggle() {
  const lang = useLang();
  return (
    <div role="group" aria-label="Language / Idioma" className="flex rounded-md border border-line p-0.5 text-xs">
      {(["en", "pt"] as const).map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          aria-pressed={lang === l}
          onClick={() => setLang(l)}
          className={`rounded px-2 py-1 font-medium uppercase transition-colors ${
            lang === l ? "bg-surface-2 text-ink" : "text-ink-3 hover:text-ink"
          }`}
        >
          {l}
        </button>
      ))}
    </div>
  );
}
