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
    description: `Load a skill's instructions, or one of its listed supporting Markdown files with file. Supporting files are relative to that skill, not vault notes. Available: ${[...byName.keys()].join(", ")}.`,
    input: { name: z.string().describe("Skill name"), file: z.string().optional().describe("Exact supporting filename listed by use_skill; omit for SKILL.md") },
    handler: async ({ name, file }) => {
      const skill = byName.get(name);

      if (!skill) return { text: `Unknown skill "${name}".`, isError: true };
      const available = Object.keys(skill.supportingFiles ?? {});
      if (file !== undefined) {
        return Object.hasOwn(skill.supportingFiles ?? {}, file)
          ? { text: skill.supportingFiles![file] }
          : { text: `Supporting file "${file}" is unavailable for skill "${name}". Available: ${available.join(", ") || "none"}. These are skill files, not vault notes.`, isError: true };
      }
      const supporting = available.length ? `\n\nSupporting files: ${available.join(", ")}. Read them with use_skill(name: "${name}", file: "<listed filename>"); do not look them up as vault notes.` : "";
      const missing = skill.unavailableSupportingFiles?.length ? `\nUnavailable supporting files: ${skill.unavailableSupportingFiles.join(", ")}. Report this gap instead of guessing other paths.` : "";
      return { text: skill.body + supporting + missing };
    },
  });

  return [useSkill];
}
