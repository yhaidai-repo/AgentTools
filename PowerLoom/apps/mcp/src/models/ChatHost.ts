import type { AgentDepsFactory } from "@powerloom/agents";
import type { PowerLoomPort, SkillCatalog } from "@powerloom/core";
import type { PowerLoomDb } from "@powerloom/db";

// What every chat session is built from: the vault deps, and the commands' context (PowerLoom, the skill folders).
export interface ChatHost {
  db: PowerLoomDb;
  deps: AgentDepsFactory;
  powerloom: PowerLoomPort;
  backlogMount: string;
  skills: SkillCatalog;
}
