"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { T, tr } from "@/lib/i18n";
import { useLang } from "@/lib/use-lang";

import { LanguageToggle } from "./language-toggle";

const LINKS = [
  { href: "/", en: "Fixtures", pt: "Jogos" },
  { href: "/ranking/", en: "Ranking", pt: "Ranking" },
  { href: "/players/", en: "Players", pt: "Jogadores" },
  { href: "/performance/", en: "AI record", pt: "Histórico IA" },
  { href: "/methodology/", en: "How it works", pt: "Como funciona" },
];

function isActive(href: string, pathname: string) {
  if (href === "/") return pathname === "/" || pathname.startsWith("/match");
  if (href === "/players/") return pathname.startsWith("/players") || pathname.startsWith("/player");
  if (href === "/ranking/") return pathname.startsWith("/ranking") || pathname.startsWith("/team");
  return pathname.startsWith(href.replace(/\/$/, ""));
}

/** The inline links, for wide screens. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex whitespace-nowrap text-sm">
      {LINKS.map(({ href, en, pt }) => {
        const active = isActive(href, pathname);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`rounded-md px-2.5 py-1.5 transition-colors ${
              active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
            }`}
          >
            <T en={en} pt={pt} />
          </Link>
        );
      })}
    </nav>
  );
}

/** Phones and tablets: a menu button that opens the links as a panel under the header. */
export function MobileMenu() {
  const pathname = usePathname();
  const lang = useLang();
  const [open, setOpen] = useState(false);
  const [openedAt, setOpenedAt] = useState(pathname);

  // Close once the page changes (adjusting state during render, not in an effect).
  if (open && openedAt !== pathname) {
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      root.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const label = open ? tr(lang, "Close menu", "Fechar menu") : tr(lang, "Open menu", "Abrir menu");
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={label}
        title={label}
        onClick={() => {
          setOpenedAt(pathname);
          setOpen((o) => !o);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-line text-ink-2 transition-colors hover:text-ink"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
          {open ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
        </svg>
      </button>
      {open && (
        <div className="absolute inset-x-0 top-full h-dvh bg-black/30" onClick={() => setOpen(false)}>
          <div
            id="mobile-menu"
            className="pop-in border-b border-line bg-surface px-4 pb-4 pt-2 shadow-lg sm:px-6"
            onClick={(e) => e.stopPropagation()}
          >
            <nav aria-label="Main" className="mx-auto flex max-w-6xl flex-col">
              {LINKS.map(({ href, en, pt }) => {
                const active = isActive(href, pathname);
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    onClick={() => setOpen(false)}
                    className={`flex items-center justify-between rounded-lg px-3 py-3 text-base transition-colors ${
                      active ? "bg-surface-2 font-medium text-ink" : "text-ink-2 hover:text-ink"
                    }`}
                  >
                    <T en={en} pt={pt} />
                    {active && <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" aria-hidden="true" />}
                  </Link>
                );
              })}
            </nav>
            <div className="mx-auto mt-3 flex max-w-6xl items-center justify-between border-t border-line px-3 pt-4 text-sm text-ink-2">
              <T en="Language" pt="Idioma" />
              <LanguageToggle />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
