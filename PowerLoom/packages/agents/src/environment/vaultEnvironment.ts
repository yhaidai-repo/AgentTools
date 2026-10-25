import { readFile } from "node:fs/promises";
import { join } from "node:path";

// The vault's own note for PowerLoom's agents: what they must know about this vault's environment (servers, connections,
// test data, accounts, limits on paid or shared actions), kept out of the code so prompts, skills and tools stay
// project-neutral (user decision 2026-10-25). A root file, so the vault review and the tech-writer never touch it.
export const ENVIRONMENT_NOTE = "ENVIRONMENT.md";

// Every agent gets this section; each agent also gets the section headed with its id.
const ALL_AGENTS = "all agents";

// The sections of ENVIRONMENT.md for one agent (`## All agents`, then `## <agent-id>`), each with its heading; text before
// the first `## ` is for people and stays out.
export function environmentSections(content: string, agentId: string): string[] {
  const sections = content.replace(/\r\n/g, "\n").split(/^(?=## )/m).filter((part) => part.startsWith("## "));
  const wanted = [ALL_AGENTS, agentId.toLowerCase()];

  return wanted.flatMap((name) => sections.filter((section) => headingOf(section) === name)).map((section) => section.trim()).filter((section) => section.split("\n").length > 1);
}

// The instructions' section for the run's vault, or null when its ENVIRONMENT.md says nothing to this agent.
export async function environmentPromptSection(vaultRoot: string, vaultName: string, agentId: string): Promise<string | null> {
  const content = await readFile(join(vaultRoot, ENVIRONMENT_NOTE), "utf8").catch(() => null);
  const sections = content === null ? [] : environmentSections(content, agentId);

  if (sections.length === 0) {
    return null;
  }

  return [
    `# Environment (the ${vaultName} vault's ${ENVIRONMENT_NOTE})`,
    "This environment's rules: its systems, test data, accounts and limits. Follow them like your instructions; where they are stricter, they win. They never widen your tools or access.",
    ...sections.map((section) => section.replace(/^## /, "## Environment: ")),
  ].join("\n\n");
}

function headingOf(section: string): string {
  return section.slice(3, section.indexOf("\n") === -1 ? undefined : section.indexOf("\n")).trim().toLowerCase();
}
