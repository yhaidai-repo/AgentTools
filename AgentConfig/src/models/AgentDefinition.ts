import type { AgentIntegrationSpec } from "./AgentIntegrationSpec";
import type { AgentBudgets } from "./AgentBudgets";
import type { AgentCapabilities } from "./AgentCapabilities";
import type { AgentLimits } from "./AgentLimits";
import type { AgentOptionSpec } from "./AgentOptionSpec";
import type { AgentOptionValue } from "./AgentOptionValue";
import type { ModelChoice } from "./ModelChoice";
import type { ShippedFields } from "./ShippedFields";

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
  /** The agent's own instructions (user decision 2026-10-22); empty = the prompt file shipped with the code, if any. */
  prompt?: string;
  /** The stored prompt's version; every edit is a new one. 0 while the prompt file applies. */
  promptVersion?: number;
  /** builtin: shipped in code, kept by ensureDefaults; user: created in the UI, may be deleted. Missing = builtin. */
  origin?: "builtin" | "user";
  /** Agent-specific settings, e.g. { batchSize: 2, maxFailures: 3 }; only keys declared in optionSpecs. */
  options: Record<string, AgentOptionValue>;
  /** Task types this agent may create tasks of (the user always may get one), e.g. ["research", "design"]. */
  canAssign: string[];
  /** Task types this agent takes: open tasks of these types for any agent, besides the tasks pinned to it. */
  handles: string[];
  /** Blockers the app checks before starting this agent, e.g. ["questions", "drafts"]; the app defines the keys. */
  waitFor: string[];
  /** The options this agent's code reads. Always taken from the code's defaults, so stored copies can't drift. */
  optionSpecs: AgentOptionSpec[];
  /** The integrations the host can give this agent. Always taken from the code's defaults, like optionSpecs. */
  integrationSpecs: AgentIntegrationSpec[];
  /** System agents: the code-owned fields as the code shipped them when last applied (see shippedFields). */
  shipped?: ShippedFields;
}
