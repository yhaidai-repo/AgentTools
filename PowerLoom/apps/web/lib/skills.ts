import { listSkills, type SkillCatalog } from "@agenttools/runtime/skills";
import type { SkillFolder } from "@/models/SkillFolder";

// The same folders, in the same order, as the agent-runner (SKILL_FOLDERS), so the choices match what runs can load.
export async function loadSkillCatalog(): Promise<SkillCatalog> {
  return listSkills(skillFolders().map((folder) => folder.path));
}

// PowerLoom's own skills, mounted from the repo; the only folder PowerLoom may write.
const POWERLOOM_SKILLS_FOLDER = "/app/PowerLoom/skills";

// Where each folder lives on the host, so the user knows where to add a skill.
export function skillFolders(): SkillFolder[] {
  const paths = (process.env.SKILL_FOLDERS ?? "").split(":").filter(Boolean);

  return paths.map((path) => ({ path, hostPath: hostPathOf(path), editable: path === POWERLOOM_SKILLS_FOLDER }));
}

// The one folder PowerLoom may write, for the skill catalog the commands read.
export function editableSkillFolder(): string {
  return POWERLOOM_SKILLS_FOLDER;
}

export function isEditableSkillFolder(path: string): boolean {
  return skillFolders().some((folder) => folder.path === path && folder.editable);
}

function hostPathOf(path: string): string {
  if (path === "/skills") {
    return `${process.env.SKILLS_PATH ?? "SKILLS_PATH in .env"} (your personal skills, also used by Claude Code)`;
  }

  if (path === "/app/DevSecrets/skills") {
    return "D:/Projects/AgentTools/DevSecrets/skills (DevSecrets tool skills, in the AgentTools repo)";
  }

  if (path === POWERLOOM_SKILLS_FOLDER) {
    return "D:/Projects/AgentTools/PowerLoom/skills (PowerLoom's own skills, in the repo)";
  }

  return path;
}
