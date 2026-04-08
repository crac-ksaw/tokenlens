import type { IngestEvent } from "@tokenlens/shared";
import { detectAnomaly } from "./anomaly.js";
import { enforceBudgets } from "./budget-guard.js";
import type { WorkerDependencies } from "./contracts.js";
import { enrichEvent } from "./costing.js";

export class IngestWorker {
  constructor(private readonly deps: WorkerDependencies) {}

  async process(event: IngestEvent) {
    const results = await this.processBatch([event]);
    return results[0];
  }

  async processBatch(events: IngestEvent[]) {
    if (events.length === 0) return [];
    
    const results = [];
    const enrichedEvents = [];

    for (const event of events) {
      const enriched = enrichEvent(event);
      const baseline = await this.deps.baselineRepository.getBaseline(event.workspaceId, event.feature);
      const anomaly = detectAnomaly(enriched.usdCost, baseline);
      enriched.isAnomaly = anomaly.isAnomaly;
      enriched.anomalyScore = anomaly.score;
      enrichedEvents.push(enriched);

      if (anomaly.isAnomaly) {
        await this.deps.budgetRepository.saveAnomaly({
          workspaceId: event.workspaceId,
          feature: event.feature,
          model: event.model,
          usdCost: enriched.usdCost,
          anomalyScore: anomaly.score,
          traceId: event.traceId,
        });
        const configs = await this.deps.budgetRepository.getAlertConfigs(event.workspaceId);
        await this.deps.alertDispatcher.dispatch(configs, {
          type: "anomaly",
          severity: "critical",
          summary: `Anomalous LLM cost detected for ${event.feature}`,
          workspaceId: event.workspaceId,
          feature: event.feature,
          traceId: event.traceId,
          usdCost: enriched.usdCost,
          anomalyScore: anomaly.score,
        });
      }

      const budgets = await this.deps.budgetRepository.getBudgets(event.workspaceId, event.feature);
      const budgetDecision = await enforceBudgets(
        budgets,
        this.deps.counterStore,
        event.workspaceId,
        event.feature,
        enriched.usdCost,
      );

      if (budgetDecision.exceeded) {
        const configs = await this.deps.budgetRepository.getAlertConfigs(event.workspaceId);
        await this.deps.alertDispatcher.dispatch(configs, {
          type: "budget",
          severity: budgetDecision.triggeredKillSwitch ? "critical" : "warning",
          summary: `Budget threshold exceeded for ${event.feature}`,
          workspaceId: event.workspaceId,
          feature: event.feature,
          messages: budgetDecision.messages,
        });
      }

      results.push({ enriched, budgetDecision });
    }

    await this.deps.eventSink.write(enrichedEvents);

    return results;
  }
}