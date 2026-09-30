import type { AdoClient } from "@adoa/ado";
import type { AdoSettings } from "@adoa/core";
import type { AdoaDb } from "@adoa/db";
import type { VaultWriter } from "@adoa/vault";

export interface SyncContext {
  db: AdoaDb;
  client: AdoClient;
  ado: AdoSettings;
  writer: VaultWriter;
  runId: number;
}
