import { createDb, type PowerLoomDb } from "@powerloom/db";
import type { Pool } from "pg";

const cache = globalThis as unknown as { powerLoomDb?: ReturnType<typeof createDb> };

// One pool per server process, surviving dev hot reloads.
export function getDb(): PowerLoomDb {
  return connection().db;
}

export function getPool(): Pool {
  return connection().pool;
}

function connection(): ReturnType<typeof createDb> {
  cache.powerLoomDb ??= createDb();

  return cache.powerLoomDb;
}
