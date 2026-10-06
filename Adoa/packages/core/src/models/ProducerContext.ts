import type { AdoaDb } from "@adoa/db";

export interface ProducerContext {
  db: AdoaDb;
  /** The schedule's vault: what the task is about. */
  vault: string;
  /** The target agent's Config options (e.g. the vault review's staleDays). */
  agentOptions: Record<string, unknown>;
}
