import type { SkillInfo, ToolDefinition } from "@agenttools/runtime";

export interface StageSkills {
  skills: SkillInfo[];
  tools: ToolDefinition<any>[];
  promptSection: string;
  /** Names from the agent's config. */
  configured: string[];
  /** Names the task's PBI added (refinement's recommendation or the user's list). */
  fromPbi: string[];
  /** PBI skills no folder has any more: left out, and logged by the executor. */
  skipped: string[];
}
