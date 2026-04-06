import type { ReactNode } from "react";

export function MetricCard({ label, value, accent }: { label: string; value: string; accent: ReactNode }) {
  return (
    <article className="rounded-3xl border border-white/60 bg-white/80 p-5 shadow-panel backdrop-blur">
      <div className="mb-4 text-xs uppercase tracking-[0.3em] text-slate-500">{label}</div>
      <div className="flex items-end justify-between gap-4">
        <div className="font-display text-3xl text-ink">{value}</div>
        <div className="text-sm text-ocean">{accent}</div>
      </div>
    </article>
  );
}