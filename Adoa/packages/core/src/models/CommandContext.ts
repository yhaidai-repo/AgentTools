import type { AdoaDb } from "@adoa/db";
import type { BacklogNotes } from "./BacklogNotes";
import type { ContinueEnv } from "./ContinueEnv";
import type { JobPort } from "./JobPort";
import type { SkillCatalog } from "./SkillCatalog";

// What every command runs with. Each caller (the web today, an MCP server later) supplies its own adapters.
export interface CommandContext {
  db: AdoaDb;
  actor: string; // who acts, for status_history: "human" from the web
  jobs: JobPort;
  notes: BacklogNotes;
  skills: SkillCatalog;
  docsVaultName: string | null; // the docs vault's folder under the vaults root (its registers, its www-log.md)
  continueEnv: ContinueEnv | null;
}
