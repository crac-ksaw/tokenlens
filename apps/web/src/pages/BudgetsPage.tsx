import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function BudgetsPage() {
  const queryClient = useQueryClient();
  const budgets = useQuery({ queryKey: ["budgets"], queryFn: async () => (await api.get("/budgets")).data });
  const [feature, setFeature] = useState("summaries");
  const [dailyLimitUsd, setDailyLimitUsd] = useState(25);
  const [monthlyLimitUsd, setMonthlyLimitUsd] = useState(400);
  const [action, setAction] = useState("alert");

  const createBudget = useMutation({
    mutationFn: async () => api.post("/budgets", { feature, dailyLimitUsd, monthlyLimitUsd, action }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["budgets"] }),
  });

  return (
    <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Budget guardrails</div>
        <h2 className="mt-2 font-display text-3xl text-ink">Turn attribution into policy.</h2>
        <div className="mt-6 space-y-4">
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={feature} onChange={(event) => setFeature(event.target.value)} placeholder="Feature" />
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" type="number" value={dailyLimitUsd} onChange={(event) => setDailyLimitUsd(Number(event.target.value))} placeholder="Daily limit" />
          <input className="w-full rounded-2xl border border-slate-200 px-4 py-3" type="number" value={monthlyLimitUsd} onChange={(event) => setMonthlyLimitUsd(Number(event.target.value))} placeholder="Monthly limit" />
          <select className="w-full rounded-2xl border border-slate-200 px-4 py-3" value={action} onChange={(event) => setAction(event.target.value)}>
            <option value="alert">Alert</option>
            <option value="block">Block</option>
          </select>
        </div>
        <button className="mt-6 rounded-full bg-ocean px-5 py-3 text-white" onClick={() => createBudget.mutate()}>Save budget</button>
      </section>

      <section className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl text-ink">Configured budgets</h3>
          <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">Live list</div>
        </div>
        <div className="mt-6 space-y-3">
          {(budgets.data ?? []).map((budget: any) => (
            <div key={budget.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium text-ink">{budget.feature}</div>
                  <div className="mt-1 text-sm text-slate-500">${budget.dailyLimitUsd}/day • ${budget.monthlyLimitUsd}/month</div>
                </div>
                <div className="rounded-full bg-sand px-3 py-1 text-xs uppercase tracking-[0.25em] text-ember">{budget.action}</div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}