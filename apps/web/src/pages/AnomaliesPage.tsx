import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { api } from "../lib/api";

export function AnomaliesPage() {
  const anomalies = useQuery({
    queryKey: ["anomalies"],
    queryFn: async () => (await api.get("/analytics/anomalies")).data,
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="font-mono text-xs uppercase tracking-[0.35em] text-ember">Anomaly log</div>
        <h2 className="mt-2 font-display text-4xl text-ink">Investigate spend spikes before they become incidents.</h2>
      </div>

      <div className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white shadow-panel">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="px-5 py-4 font-medium">Feature</th>
              <th className="px-5 py-4 font-medium">Model</th>
              <th className="px-5 py-4 font-medium">USD cost</th>
              <th className="px-5 py-4 font-medium">Z-score</th>
              <th className="px-5 py-4 font-medium">Created</th>
            </tr>
          </thead>
          <tbody>
            {(anomalies.data ?? []).map((row: any) => (
              <tr key={row.id} className="border-t border-slate-100">
                <td className="px-5 py-4 font-medium text-ink">{row.feature}</td>
                <td className="px-5 py-4">{row.model}</td>
                <td className="px-5 py-4 text-ember">${Number(row.usdCost).toFixed(4)}</td>
                <td className="px-5 py-4">{Number(row.anomalyScore).toFixed(2)}</td>
                <td className="px-5 py-4 text-slate-500">{format(new Date(row.createdAt), "MMM d, yyyy HH:mm")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}