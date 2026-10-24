import { z } from "zod";
import { defineTool } from "../defineTool";
import type { SkillInfo } from "../models/SkillInfo";
import type { ToolDefinition } from "../models/ToolDefinition";

// Provider-neutral skills: the prompt lists names and descriptions; the full text loads only on demand.
export function skillsPromptSection(skills: SkillInfo[]): string {
  if (skills.length === 0) {
    return "";
  }

  const lines = skills.map((skill) => `- ${skill.name}: ${skill.description}`);

  return ["## Skills", "Load a skill with `use_skill` when its description fits your task:", ...lines].join("\n");
}

export function createSkillTools(skills: SkillInfo[]): ToolDefinition<any>[] {
  if (skills.length === 0) {
    return [];
  }

  const byName = new Map(skills.map((skill) => [skill.name, skill]));
  const useSkill = defineTool({
    name: "use_skill",
    description: `Load the full instructions of a skill. Available: ${[...byName.keys()].join(", ")}.`,
    input: { name: z.string().describe("Skill name") },
    handler: async ({ name }) => {
      const skill = byName.get(name);

      return skill ? { text: skill.body } : { text: `Unknown skill "${name}".`, isError: true };
    },
  });

  return [useSkill];
}
