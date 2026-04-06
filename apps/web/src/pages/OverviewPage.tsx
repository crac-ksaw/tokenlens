import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "../lib/api";
import { MetricCard } from "../components/MetricCard";

const from = new Date(Date.now() - (30 * 86400000)).toISOString();
const to = new Date().toISOString();

export function OverviewPage() {
  const overview = useQuery({
    queryKey: ["overview"],
    queryFn: async () => (await api.get("/analytics/overview", { params: { from, to } })).data,
  });
  const timeseries = useQuery({
    queryKey: ["timeseries"],
    queryFn: async () => (await api.get("/analytics/timeseries", { params: { from, to, granularity: "day" } })).data,
  });
  const byFeature = useQuery({
    queryKey: ["feature-breakdown"],
    queryFn: async () => (await api.get("/analytics/by-feature", { params: { from, to } })).data,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Control room</div>
          <h2 className="mt-2 font-display text-4xl text-ink">Usage patterns across your LLM surface area.</h2>
        </div>
        <div className="rounded-full bg-sand px-4 py-2 text-sm text-slate-600">Last 30 days</div>
      </div>

      <section className="grid gap-4 md:grid-cols-4">
        <MetricCard label="Total cost" value={`$${(overview.data?.totalCost ?? 0).toFixed(2)}`} accent="30d" />
        <MetricCard label="Total tokens" value={`${Math.round(overview.data?.totalTokens ?? 0).toLocaleString()}`} accent="tokens" />
        <MetricCard label="Total calls" value={`${Math.round(overview.data?.totalCalls ?? 0)}`} accent="requests" />
        <MetricCard label="Avg latency" value={`${Math.round(overview.data?.avgLatencyMs ?? 0)}ms`} accent="p50" />
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl text-ink">Spend over time</h3>
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">Daily</div>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries.data ?? []}>
                <defs>
                  <linearGradient id="costGradient" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="5%" stopColor="#0f3d5e" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="#0f3d5e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bucket" tickFormatter={(value) => format(new Date(value), "MMM d")} stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <Tooltip labelFormatter={(value) => format(new Date(value), "MMM d, yyyy")} formatter={(value: number) => [`$${value.toFixed(2)}`, "Cost"]} />
                <Area type="monotone" dataKey="cost" stroke="#0f3d5e" fill="url(#costGradient)" strokeWidth={3} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="font-display text-2xl text-ink">Feature mix</h3>
            <div className="font-mono text-xs uppercase tracking-[0.25em] text-slate-400">Sorted by cost</div>
          </div>
          <div className="space-y-3">
            {(byFeature.data ?? []).map((row: any) => (
              <div key={row.key} className="rounded-2xl bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-ink">{row.key}</div>
                  <div className="font-mono text-sm text-ocean">${row.cost.toFixed(2)}</div>
                </div>
                <div className="mt-2 text-sm text-slate-500">{row.calls} calls • {Math.round(row.tokens).toLocaleString()} tokens</div>
              </div>
            ))}
          </div>
        </article>
      </section>
    </div>
  );
}