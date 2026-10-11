import { PgBoss } from "pg-boss";

// Every queue moved to PowerLoom (the vault's adoa-backend-delivery note, phase 5): nothing sends a pg-boss job any
// more. The worker keeps pg-boss's maintenance going until phase 6 removes pg-boss, the worker and the job tables.
export function createWorkerBoss(url: string): PgBoss {
  return new PgBoss({ connectionString: url });
}
