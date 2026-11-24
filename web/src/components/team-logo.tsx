"use client";

import { useState } from "react";

const CDN = "https://a.espncdn.com";

/** ESPN's resizing proxy, so a 20px crest does not download a 500px file. */
const resized = (path: string, px: number) => `${CDN}/combiner/i?img=${path}&w=${px}&h=${px}`;

/**
 * A logo with ESPN's dark-background variant ("500-dark") in the dark theme. Many crests
 * are black or navy and vanish on a dark surface. Both images are in the markup and CSS
 * shows the one for the current theme (lazy images that are hidden are never fetched).
 * When a club has no dark variant (404), the regular one is used in both themes.
 */
export function ThemedLogo({
  path,
  size,
  onFail,
}: {
  /** CDN path of the regular logo, containing "/500/". */
  path: string;
  size: number;
  onFail?: () => void;
}) {
  const [noDark, setNoDark] = useState(false);
  const px = size <= 24 ? 48 : 96;
  const darkPath = path.includes("/500/") ? path.replace("/500/", "/500-dark/") : null;
  const common = {
    width: size,
    height: size,
    loading: "lazy" as const,
    decoding: "async" as const,
    style: { width: size, height: size },
  };
  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, remote CDN image */}
      <img
        alt=""
        {...common}
        src={resized(path, px)}
        onError={onFail}
        className={`shrink-0 object-contain ${darkPath && !noDark ? "logo-light" : ""}`}
      />
      {darkPath && !noDark && (
        // eslint-disable-next-line @next/next/no-img-element -- static export, remote CDN image
        <img alt="" {...common} src={resized(darkPath, px)} onError={() => setNoDark(true)} className="logo-dark shrink-0 object-contain" />
      )}
    </>
  );
}

/**
 * Club crest from ESPN's CDN, with an initials fallback when a club has no ESPN id or the
 * image fails to load. Crests belong to their clubs.
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
        style={{
          width: size,
          height: size,
          fontSize: Math.max(8, size * 0.38),
        }}
      >
        {initials}
      </span>
    );
  }
  return <ThemedLogo path={`/i/teamlogos/soccer/500/${id}.png`} size={size} onFail={() => setFailed(true)} />;
}
