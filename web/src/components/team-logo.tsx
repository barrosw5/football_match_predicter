"use client";

import { useState } from "react";

/**
 * Club crest from ESPN's CDN (small, resized variant), with an initials fallback when a
 * club has no ESPN id or the image fails to load. Crests belong to their clubs.
 */
export function TeamLogo({ id, name, size = 20 }: { id?: string | null; name: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!id || failed) {
    const initials = name
      .replace(/[^\p{L}\p{N} ]/gu, "")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
    return (
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2 font-semibold text-ink-3"
        style={{ width: size, height: size, fontSize: Math.max(8, size * 0.38) }}
      >
        {initials}
      </span>
    );
  }
  const px = size <= 24 ? 48 : 96;
  return (
    // eslint-disable-next-line @next/next/no-img-element -- static export, remote CDN image
    <img
      src={`https://a.espncdn.com/combiner/i?img=/i/teamlogos/soccer/500/${id}.png&w=${px}&h=${px}`}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}
