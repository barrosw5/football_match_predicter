import type { Metadata } from "next";
import { Suspense } from "react";

import { PlayerView } from "@/components/player-view";

export const metadata: Metadata = { title: "Player" };

// One static page for every player: the browser reads ?id= and loads that player's JSON.
export default function PlayerPage() {
  return (
    <Suspense fallback={<p className="py-16 text-center text-ink-3">…</p>}>
      <PlayerView />
    </Suspense>
  );
}
