import type { ReactNode } from "react";

export function StatTile({ label, value, detail }: { label: ReactNode; value: ReactNode; detail?: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-line bg-surface px-3 py-3 sm:px-4 sm:py-3.5">
      <div className="text-sm leading-5 text-ink-2">{label}</div>
      <div className="tnum mt-1 text-2xl font-semibold tracking-tight">{value}</div>
      {detail && <div className="tnum mt-1 text-xs leading-5 text-ink-2">{detail}</div>}
    </div>
  );
}
