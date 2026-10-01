export interface StageSettings {
  enabled: boolean;
  cron: string;
  batchSize: number;
  provider: string;
  model: string;
  maxTurns: number;
  timeoutMinutes: number;
  perRunBudgetUsd: number;
  dailyBudgetUsd: number;
  /** Skill names the agent may load with use_skill. */
  skills: string[];
  /** Failed runs after which a PBI is skipped until it is prepared again. */
  maxFailures: number;
}
