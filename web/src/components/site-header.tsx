import Link from "next/link";

import { LanguageToggle } from "./language-toggle";
import { MobileMenu, NavLinks } from "./nav-links";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    // Sticky on phones and tablets, where the menu button should stay in reach.
    <header className="sticky top-0 z-40 border-b border-line bg-surface lg:static">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-x-6 px-4 py-2.5 sm:px-6 lg:py-3">
        <Link href="/" className="flex items-center gap-2.5 font-semibold tracking-tight">
          <PitchMark />
          <span>Match Predictor</span>
        </Link>
        <div className="hidden items-center gap-3 lg:flex">
          <NavLinks />
          <LanguageToggle />
          <ThemeToggle />
        </div>
        <div className="flex items-center gap-2 lg:hidden">
          <ThemeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}

function PitchMark() {
  return (
    <svg width="26" height="18" viewBox="0 0 26 18" aria-hidden="true" className="text-ink">
      <rect x="1" y="1" width="24" height="16" rx="2.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <line x1="13" y1="1" x2="13" y2="17" stroke="currentColor" strokeWidth="1.5" />
      <circle cx="13" cy="9" r="3" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <rect x="1" y="5.5" width="3.5" height="7" fill="var(--home)" />
      <rect x="21.5" y="5.5" width="3.5" height="7" fill="var(--away)" />
    </svg>
  );
}
