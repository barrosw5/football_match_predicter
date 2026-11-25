import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";

import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { getMeta } from "@/lib/data";
import { LANG_BOOTSTRAP } from "@/lib/i18n";

import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: {
    default: "Football Match Predictor",
    template: "%s · Football Match Predictor",
  },
  description:
    "Machine-learning forecasts for 21 European leagues and the UEFA club competitions, updated automatically every day, with a public track record of every prediction.",
};

// Browser chrome on phones matches the header in either theme.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfb" },
    { media: "(prefers-color-scheme: dark)", color: "#1a1a19" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  const meta = getMeta();
  return (
    // data-lang / lang are set before paint by LANG_BOOTSTRAP, hence suppressHydrationWarning
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: LANG_BOOTSTRAP }} />
      </head>
      <body className="flex min-h-full flex-col bg-bg text-ink">
        <SiteHeader />
        <main className="page-enter mx-auto w-full max-w-6xl flex-1 px-4 pb-16 sm:px-6">{children}</main>
        <SiteFooter generatedAt={meta.generatedAt} />
      </body>
    </html>
  );
}
