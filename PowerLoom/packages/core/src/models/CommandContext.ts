import type { PowerLoomDb } from "@powerloom/db";
import type { PowerLoomPort } from "./PowerLoomPort";
import type { SkillCatalog } from "./SkillCatalog";

// What every command runs with. Each caller (the web today, an MCP server later) supplies its own adapters.
export interface CommandContext {
  db: PowerLoomDb;
  actor: string; // who acts, for status_history: "human" from the web
  powerloom: PowerLoomPort;
  skills: SkillCatalog;
}
