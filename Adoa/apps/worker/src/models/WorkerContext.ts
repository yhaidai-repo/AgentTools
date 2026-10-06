import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { PgBoss } from "pg-boss";

export interface WorkerContext {
  db: AdoaDb;
  config: AgentConfigStore;
  boss: PgBoss;
  /** adoa's backlog vault; each vault's backlog is a folder in it (vaultBacklogRoot). */
  backlogMount: string;
}
