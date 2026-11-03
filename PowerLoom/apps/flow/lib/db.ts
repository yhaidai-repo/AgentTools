import { createDb } from "@powerloom/db";
import type { Pool } from "pg";

const cache = globalThis as unknown as { powerLoomFlowDb?: ReturnType<typeof createDb> };

// One pool per server process, surviving dev hot reloads (same pattern as apps/web).
export function getPool(): Pool {
  cache.powerLoomFlowDb ??= createDb();

  return cache.powerLoomFlowDb.pool;
}
