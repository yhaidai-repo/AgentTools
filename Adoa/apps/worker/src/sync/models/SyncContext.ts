import type { AdoClient } from "@adoa/ado";
import type { AdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";

export interface SyncContext {
  db: AdoaDb;
  client: AdoClient;
  ado: AdoSettings;
  runId: number;
}
