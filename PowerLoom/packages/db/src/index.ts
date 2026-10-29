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
export type { PlanContent } from "./models/PlanContent";
export type { PlanDecision } from "./models/PlanDecision";
export type { PlanAutoChoice } from "./models/PlanAutoChoice";
export type { PlanRequirement } from "./models/PlanRequirement";
export type { PhasePlan } from "./models/PhasePlan";
export type { PhasePlanTask } from "./models/PhasePlanTask";
export type { PlanRisk } from "./models/PlanRisk";
export type { PlanCheck } from "./models/PlanCheck";
export { PLAN_CHECK_VERDICTS, type PlanCheckVerdict } from "./models/PlanCheckVerdict";
export type { BuildContent } from "./models/BuildContent";
export type { BuildCommands } from "./models/BuildCommands";
export type { BuildCheck } from "./models/BuildCheck";
export type { BuildChecks } from "./models/BuildChecks";
export type { BuildPlan } from "./models/BuildPlan";
export { BUILD_PLAN_STATUSES, type BuildPlanStatus } from "./models/BuildPlanStatus";
export type { BuildCommit } from "./models/BuildCommit";
export type { BuildDeviation } from "./models/BuildDeviation";
export type { BuildCheckpoint } from "./models/BuildCheckpoint";
export type { PhaseVerification } from "./models/PhaseVerification";
export type { VerificationTruth } from "./models/VerificationTruth";
export type { OpenUatItem } from "./models/OpenUatItem";
export type { BuildHandOver } from "./models/BuildHandOver";
export { HAND_OVER_STATES, type HandOverState } from "./models/HandOverState";

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
export { HANDOFF_INTENTS, type HandoffIntent } from "./models/HandoffIntent";
export { HANDOFF_GATES, type HandoffGate } from "./models/HandoffGate";
export { HANDOFF_TARGET_KINDS, type HandoffTargetKind } from "./models/HandoffTargetKind";
export type { HandoffStatus } from "./models/HandoffStatus";
export type { HandoffRefs } from "./models/HandoffRefs";
