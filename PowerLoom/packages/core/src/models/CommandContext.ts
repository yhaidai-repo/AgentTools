import type { RecordWorkContext } from "@powerloom/vault";
import type { AgentConfigStore } from "@agenttools/config";
import type { UsageStore } from "@agenttools/usage";
import type { PowerLoomDb } from "@powerloom/db";
import type { HostFolder } from "./HostFolder";
import type { PowerLoomPort } from "./PowerLoomPort";
import type { SkillCatalog } from "./SkillCatalog";

// What every command runs with. Each caller (the web today, an MCP server later) supplies its own adapters.
export interface CommandContext {
  /** Trusted caller context; MCP supplies its actual session id. */
  recordContext?: RecordWorkContext;
  db: PowerLoomDb;
  actor: string; // who acts, for status_history: "human" from the web
  powerloom: PowerLoomPort;
  skills: SkillCatalog;
  /** Where the rendered backlogs of all vaults are mounted (BACKLOG_MOUNT): commands read PBI notes from it. */
  backlogMount: string;
  /** The agent definitions, for the commands that create or change agents; absent where a caller may not (an agent run). */
  agents?: AgentConfigStore;
  /** The runs' usage records and traces (AgentUsage), for the read commands on runs and costs; absent in an agent run. */
  usage?: UsageStore;
  /** The PC folders this caller can read files from (the MCP's vaults and repos mounts), for a file named by its PC path. */
  hostFolders?: HostFolder[];
}
