import type { PricingEntry } from "./types.js";

export const pricingTable: Record<string, PricingEntry> = {
  "gpt-4o": { inputPer1M: 2.5, outputPer1M: 10 },
  "gpt-4o-mini": { inputPer1M: 0.15, outputPer1M: 0.6 },
  "gpt-4-turbo": { inputPer1M: 10, outputPer1M: 30 },
  "gpt-3.5-turbo": { inputPer1M: 0.5, outputPer1M: 1.5 },
  "claude-opus-4-6": { inputPer1M: 15, outputPer1M: 75 },
  "claude-sonnet-4-6": { inputPer1M: 3, outputPer1M: 15 },
  "claude-haiku-4-5-20251001": { inputPer1M: 0.8, outputPer1M: 4 },
  "gemini-1.5-pro": { inputPer1M: 1.25, outputPer1M: 5 },
  "gemini-1.5-flash": { inputPer1M: 0.075, outputPer1M: 0.3 }
};

export function getPricingForModel(model: string): PricingEntry {
  return pricingTable[model] ?? pricingTable["gpt-4o-mini"];
}

export function calculateUsdCost(model: string, promptTokens: number, completionTokens: number): number {
  const pricing = getPricingForModel(model);
  const inputCost = (promptTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (completionTokens / 1_000_000) * pricing.outputPer1M;
  return Number((inputCost + outputCost).toFixed(8));
}

export function calculateCostPer1kTokens(model: string): number {
  const pricing = getPricingForModel(model);
  return Number((((pricing.inputPer1M + pricing.outputPer1M) / 2) / 1000).toFixed(8));
}