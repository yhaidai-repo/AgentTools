import { createDb, type AdoaDb } from "@adoa/db";
import type { Pool } from "pg";

const cache = globalThis as unknown as { adoaDb?: ReturnType<typeof createDb> };

// One pool per server process, surviving dev hot reloads.
export function getDb(): AdoaDb {
  return connection().db;
}

export function getPool(): Pool {
  return connection().pool;
}

function connection(): ReturnType<typeof createDb> {
  cache.adoaDb ??= createDb();

  return cache.adoaDb;
}
