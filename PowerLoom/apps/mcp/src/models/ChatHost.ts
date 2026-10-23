import type { AgentConfigStore } from "@agenttools/config";
import type { UsageStore } from "@agenttools/usage";
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
  /** The agent definitions: a chat may create agents and skills (user decision 2026-10-23). */
  agents: AgentConfigStore;
  /** The runs' usage and traces, for the read commands on runs and costs. */
  usage: UsageStore;
}
