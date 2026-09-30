import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

export * from "./schema.js";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) throw new Error("DATABASE_URL is not set");
  const pool = new pg.Pool({ connectionString: url });
  return { db: drizzle(pool, { schema }), pool };
}
