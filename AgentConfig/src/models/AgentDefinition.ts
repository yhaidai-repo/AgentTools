import type { AgentBudgets } from "./AgentBudgets";
import type { AgentCapabilities } from "./AgentCapabilities";
import type { AgentLimits } from "./AgentLimits";
import type { AgentOptionValue } from "./AgentOptionValue";
import type { ModelChoice } from "./ModelChoice";

export interface AgentDefinition {
  /** Stable key, e.g. "refinement". */
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  /** Cron expression, or null for manual runs only. */
  schedule: string | null;
  model: ModelChoice;
  limits: AgentLimits;
  budgets: AgentBudgets;
  capabilities: AgentCapabilities;
  /** Skill names the agent may load on demand. */
  skills: string[];
  /** Agent-specific settings, e.g. { batchSize: 2, maxFailures: 3 }. */
  options: Record<string, AgentOptionValue>;
}
