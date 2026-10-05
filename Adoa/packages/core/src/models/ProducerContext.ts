import type { AdoaDb } from "@adoa/db";

export interface ProducerContext {
  db: AdoaDb;
  /** The target agent's Config options (e.g. the vault review's staleDays). */
  agentOptions: Record<string, unknown>;
}
