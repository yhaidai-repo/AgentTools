import type { SkillInfo, ToolDefinition } from "@agenttools/runtime";

export interface StageSkills {
  skills: SkillInfo[];
  tools: ToolDefinition<any>[];
  promptSection: string;
}
