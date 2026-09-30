import { createDb, type AdoaDb } from "@adoa/db";

const cache = globalThis as unknown as { adoaDb?: AdoaDb };

// One pool per server process, surviving dev hot reloads.
export function getDb(): AdoaDb {
  cache.adoaDb ??= createDb().db;

  return cache.adoaDb;
}
