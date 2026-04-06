import type { BaselineStats } from "./contracts.js";

export interface AnomalyDecision {
  isAnomaly: boolean;
  score: number;
}

export function detectAnomaly(cost: number, baseline: BaselineStats | null, threshold = 3): AnomalyDecision {
  if (!baseline || baseline.stdDev <= 0) {
    return { isAnomaly: false, score: 0 };
  }

  const score = (cost - baseline.mean) / baseline.stdDev;
  return {
    isAnomaly: score > threshold,
    score: Number(score.toFixed(4)),
  };
}