import { defineTool } from "../defineTool";
import type { ToolDefinition } from "../models/ToolDefinition";
import { listSkills } from "./listSkills";

// list_skills: the skills other agents could load, for an agent that recommends some (e.g. per work item).
// `isListed` lets the app hide skills that aren't up for recommendation.
export function createListSkillsTool(folders: string[], isListed: (name: string) => boolean): ToolDefinition<any> {
  return defineTool({
    name: "list_skills",
    description: "List the skills agents can load (name and description).",
    input: {},
    handler: async () => {
      const catalog = await listSkills(folders);
      const lines = catalog.skills.filter((skill) => isListed(skill.name)).map((skill) => `- ${skill.name}: ${skill.description}`);

      return { text: lines.join("\n") || "No skills available." };
    },
  });
}
