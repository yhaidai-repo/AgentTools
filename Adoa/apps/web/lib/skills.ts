import { listSkills, type SkillCatalog } from "@agenttools/runtime/skills";
import type { SkillFolder } from "@/models/SkillFolder";

// The same folders, in the same order, as the agent-runner (SKILL_FOLDERS), so the choices match what runs can load.
export async function loadSkillCatalog(): Promise<SkillCatalog> {
  return listSkills(skillFolders().map((folder) => folder.path));
}

// Where each folder lives on the host, so the user knows where to add a skill.
export function skillFolders(): SkillFolder[] {
  const paths = (process.env.SKILL_FOLDERS ?? "").split(":").filter(Boolean);

  return paths.map((path) => ({ path, hostPath: hostPathOf(path) }));
}

function hostPathOf(path: string): string {
  if (path === "/skills") {
    return `${process.env.SKILLS_PATH ?? "SKILLS_PATH in .env"} (mounted; new skills show up at once)`;
  }

  if (path === "/app/Adoa/skills") {
    return "D:/Projects/AgentTools/Adoa/skills (adoa's own skills, built into the image: rebuild after a change)";
  }

  return path;
}
