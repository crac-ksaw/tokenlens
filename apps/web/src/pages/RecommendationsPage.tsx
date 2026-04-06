import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function RecommendationsPage() {
  const recommendations = useQuery({
    queryKey: ["recommendations"],
    queryFn: async () => (await api.get("/recommendations")).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Optimizer</div>
        <h2 className="mt-2 font-display text-4xl text-ink">Model swaps and prompt compression opportunities.</h2>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        {(recommendations.data ?? []).map((item: any) => (
          <article key={item.id} className="rounded-[1.75rem] border border-slate-200 bg-white p-5 shadow-panel">
            <div className="font-mono text-xs uppercase tracking-[0.3em] text-slate-400">{item.feature}</div>
            <h3 className="mt-2 font-display text-2xl text-ink">{item.currentModel} → {item.suggestedModel}</h3>
            <p className="mt-3 text-sm text-slate-600">{item.rationale}</p>
            <div className="mt-4 text-sm text-ember">Estimated saving: ${Number(item.estimatedSavingUsd).toFixed(2)}</div>
          </article>
        ))}
      </div>
    </div>
  );
}