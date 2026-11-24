"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { T } from "@/lib/i18n";

const LINKS = [
  { href: "/", en: "Fixtures", pt: "Jogos" },
  { href: "/ranking/", en: "Ranking", pt: "Ranking" },
  { href: "/players/", en: "Players", pt: "Jogadores" },
  { href: "/performance/", en: "Track record", pt: "Histórico" },
  { href: "/methodology/", en: "How it works", pt: "Como funciona" },
];

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="-mx-2 flex min-w-0 max-w-full overflow-x-auto whitespace-nowrap text-sm">
      {LINKS.map(({ href, en, pt }) => {
        const active =
          href === "/" ? pathname === "/" || pathname.startsWith("/match") : pathname.startsWith(href.replace(/\/$/, ""));
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
