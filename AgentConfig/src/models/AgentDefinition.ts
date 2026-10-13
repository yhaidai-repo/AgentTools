import type { AgentIntegrationSpec } from "./AgentIntegrationSpec";
import type { AgentBudgets } from "./AgentBudgets";
import type { AgentCapabilities } from "./AgentCapabilities";
import type { AgentLimits } from "./AgentLimits";
import type { AgentOptionSpec } from "./AgentOptionSpec";
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
  /** Agent-specific settings, e.g. { batchSize: 2, maxFailures: 3 }; only keys declared in optionSpecs. */
  options: Record<string, AgentOptionValue>;
  /** Agent to call after a successful task (the app creates its task), or null. */
  next: string | null;
  /** Agents this agent may create tasks for itself (the user always may get one); the app decides which agents take tasks. */
  canAssign: string[];
  /** Blockers the app checks before starting this agent, e.g. ["questions", "drafts"]; the app defines the keys. */
  waitFor: string[];
  /** The options this agent's code reads. Always taken from the code's defaults, so stored copies can't drift. */
  optionSpecs: AgentOptionSpec[];
  /** The integrations the host can give this agent. Always taken from the code's defaults, like optionSpecs. */
  integrationSpecs: AgentIntegrationSpec[];
}
