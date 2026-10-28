import type { AgentCapabilities } from "./AgentCapabilities";
import type { Conversation } from "./Conversation";
import type { ModelRef } from "./ModelRef";
import type { ProjectSettingSource } from "./ProjectSettingSource";
import type { RunLimits } from "./RunLimits";
import type { ToolDefinition } from "./ToolDefinition";
import type { ToolPolicy } from "./ToolPolicy";

export interface AgentRequest {
  runId: string;
  model: ModelRef;
  systemPrompt: string;
  firstMessage: string;
  // `any`: tools with different input shapes share one list.
  tools: ToolDefinition<any>[];
  limits: RunLimits;
  capabilities?: AgentCapabilities;
  /** Keeps the run's conversation (and continues an earlier one) when the runtime keeps conversations; else ignored. */
  conversation?: Conversation;
  /** Aborts the run from outside, e.g. when a budget is exceeded. */
  signal?: AbortSignal;
  /**
   * The folder the agent works in; the host process's working folder by default. Kept conversations are looked up in
   * the runtime's own folder, so a run with its own folder should not keep one.
   */
  cwd?: string;
  /** Settings the agent loads from its working folder; none by default. Adapters without folder settings ignore it. */
  settingSources?: ProjectSettingSource[];
  toolPolicy?: ToolPolicy;
}
