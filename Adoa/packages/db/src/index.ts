import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { AdoaDb } from "./models/AdoaDb";

export * from "./schema";
export type { AdoaDb } from "./models/AdoaDb";
export type { PbiSkill } from "./models/PbiSkill";
export type { PbiConfluencePage } from "./models/PbiConfluencePage";
export type { DesignAlternative } from "./models/DesignAlternative";
export type { DesignPlanStep } from "./models/DesignPlanStep";
export type { DesignRisk } from "./models/DesignRisk";
export type { DesignTest } from "./models/DesignTest";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new pg.Pool({ connectionString: url });
  const db: AdoaDb = drizzle(pool, { schema });

  return { db, pool };
}
