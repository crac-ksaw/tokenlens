import { calculateCostPer1kTokens, calculateUsdCost, type EnrichedEvent, type IngestEvent } from "@tokenlens/shared";

export function enrichEvent(event: IngestEvent): EnrichedEvent {
  return {
    ...event,
    eventId: event.traceId,
    usdCost: calculateUsdCost(event.model, event.tokensPrompt, event.tokensCompletion),
    costPer1kTokens: calculateCostPer1kTokens(event.model),
    isAnomaly: false,
  };
}