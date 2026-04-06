import type { Budget } from "@tokenlens/shared";
import type { CounterStore } from "./contracts.js";

export interface BudgetDecision {
  exceeded: boolean;
  triggeredKillSwitch: boolean;
  messages: string[];
}

export async function enforceBudgets(
  budgets: Budget[],
  counterStore: CounterStore,
  workspaceId: string,
  feature: string,
  usdCost: number,
): Promise<BudgetDecision> {
  if (budgets.length === 0) {
    return { exceeded: false, triggeredKillSwitch: false, messages: [] };
  }

  const dailyTotal = await counterStore.incrementDaily(workspaceId, feature, usdCost);
  const monthlyTotal = await counterStore.incrementMonthly(workspaceId, feature, usdCost);

  let exceeded = false;
  let triggeredKillSwitch = false;
  const messages: string[] = [];

  for (const budget of budgets) {
    if (dailyTotal > budget.dailyLimitUsd) {
      exceeded = true;
      messages.push(`Daily budget exceeded for ${feature}: ${dailyTotal.toFixed(4)} > ${budget.dailyLimitUsd.toFixed(2)}`);
      if (budget.action === "block") {
        await counterStore.setKillSwitch(workspaceId, feature);
        triggeredKillSwitch = true;
      }
    }

    if (monthlyTotal > budget.monthlyLimitUsd) {
      exceeded = true;
      messages.push(`Monthly budget exceeded for ${feature}: ${monthlyTotal.toFixed(4)} > ${budget.monthlyLimitUsd.toFixed(2)}`);
      if (budget.action === "block") {
        await counterStore.setKillSwitch(workspaceId, feature);
        triggeredKillSwitch = true;
      }
    }
  }

  return { exceeded, triggeredKillSwitch, messages };
}