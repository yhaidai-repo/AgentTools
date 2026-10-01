import type { AdoaDb } from "@adoa/db";
import type { AgentConfigStore } from "@agenttools/config";
import type { PgBoss } from "pg-boss";

export interface WorkerContext {
  db: AdoaDb;
  config: AgentConfigStore;
  boss: PgBoss;
  /** The rendered Vault (backlog) root. */
  vaultRoot: string;
}
