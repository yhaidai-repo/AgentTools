import { createDb, type PowerLoomDb } from "@powerloom/db";
import type { Pool } from "pg";

const cache = globalThis as unknown as { powerLoomFlowDb?: ReturnType<typeof createDb> };

// One pool per server process, surviving dev hot reloads (same pattern as apps/web). Flow reads straight from the
// database, as the web does; every change goes through PowerLoom's API (lib/commandContext.ts).
export function getDb(): PowerLoomDb {
  return connection().db;
}

export function getPool(): Pool {
  return connection().pool;
}

function connection(): ReturnType<typeof createDb> {
  cache.powerLoomFlowDb ??= createDb();

  return cache.powerLoomFlowDb;
}
