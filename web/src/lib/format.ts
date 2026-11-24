// Number and time helpers. Language-dependent text lives in i18n.tsx.

const TIME_ZONE = "Europe/Lisbon";

export function pct(x: number | null | undefined, digits = 0): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return `${(x * 100).toFixed(digits)}%`;
}

export function num(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  return x.toFixed(digits);
}

export function signed(x: number | null | undefined, digits = 1, suffix = ""): string {
  if (x === null || x === undefined || Number.isNaN(x)) return "–";
  const v = Math.abs(x).toFixed(digits);
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${v}${suffix}`;
}

export function int(x: number | null | undefined): string {
  if (x === null || x === undefined) return "–";
  return x.toLocaleString("en-GB");
}

const timeFmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: TIME_ZONE });
const dateKeyFmt = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: TIME_ZONE,
});

export const formatTime = (iso: string) => timeFmt.format(new Date(iso));
export const dateKey = (iso: string) => dateKeyFmt.format(new Date(iso));
