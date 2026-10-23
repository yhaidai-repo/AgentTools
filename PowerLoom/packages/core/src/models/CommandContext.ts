import type { AgentConfigStore } from "@agenttools/config";
import type { PowerLoomDb } from "@powerloom/db";
import type { PowerLoomPort } from "./PowerLoomPort";
import type { SkillCatalog } from "./SkillCatalog";

// What every command runs with. Each caller (the web today, an MCP server later) supplies its own adapters.
export interface CommandContext {
  db: PowerLoomDb;
  actor: string; // who acts, for status_history: "human" from the web
  powerloom: PowerLoomPort;
  skills: SkillCatalog;
  /** Where the rendered backlogs of all vaults are mounted (BACKLOG_MOUNT): commands read PBI notes from it. */
  backlogMount: string;
  /** The agent definitions, for the commands that create or change agents; absent where a caller may not (an agent run). */
  agents?: AgentConfigStore;
}
