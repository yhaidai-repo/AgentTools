import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { PowerLoomDb } from "./models/PowerLoomDb";

export * from "./schema";
export type { PowerLoomDb } from "./models/PowerLoomDb";
export type { PbiSkill } from "./models/PbiSkill";
export type { VaultFeatures } from "./models/VaultFeatures";
export type { PbiConfluencePage } from "./models/PbiConfluencePage";
export type { PbiImportResult } from "./models/PbiImportResult";
export type { DesignAlternative } from "./models/DesignAlternative";
export type { DesignPlanStep } from "./models/DesignPlanStep";
export type { DesignRisk } from "./models/DesignRisk";
export type { DesignTest } from "./models/DesignTest";

export function createDb(url = process.env.DATABASE_URL) {
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }

  const pool = new pg.Pool({ connectionString: url });
  const db: PowerLoomDb = drizzle(pool, { schema });

  return { db, pool };
}
export { OUTSIDE_KINDS, type DataAccessKind } from "./models/DataAccessKind";
export type { DataAccessOutcome } from "./models/DataAccessOutcome";
export { FAILURE_KINDS, type FailureKind } from "./models/FailureKind";
export { FAILURE_WORKAROUNDS, type FailureWorkaround } from "./models/FailureWorkaround";
export { FAILURE_IMPACTS, type FailureImpact } from "./models/FailureImpact";
