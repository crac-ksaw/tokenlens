import type { AlertConfig, AnomalyRecord, Budget, EnrichedEvent, IngestEvent } from "@tokenlens/shared";

export interface BaselineStats {
  mean: number;
  stdDev: number;
}

export interface BaselineRepository {
  getBaseline(workspaceId: string, feature: string): Promise<BaselineStats | null>;
}

export interface EventSink {
  write(events: EnrichedEvent[]): Promise<void>;
}

export interface BudgetRepository {
  getBudgets(workspaceId: string, feature: string): Promise<Budget[]>;
  getAlertConfigs(workspaceId: string): Promise<AlertConfig[]>;
  saveAnomaly(record: Omit<AnomalyRecord, "id" | "createdAt">): Promise<void>;
}

export interface CounterStore {
  incrementDaily(workspaceId: string, feature: string, amount: number): Promise<number>;
  incrementMonthly(workspaceId: string, feature: string, amount: number): Promise<number>;
  setKillSwitch(workspaceId: string, feature: string): Promise<void>;
}

export interface AlertDispatcher {
  dispatch(configs: AlertConfig[], payload: Record<string, unknown>): Promise<void>;
}

export interface WorkerDependencies {
  baselineRepository: BaselineRepository;
  eventSink: EventSink;
  budgetRepository: BudgetRepository;
  counterStore: CounterStore;
  alertDispatcher: AlertDispatcher;
}