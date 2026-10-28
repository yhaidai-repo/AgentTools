import { implementationSnapshot, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import type { BuildVersion } from "../models/BuildVersion";

const BUILD_COLUMNS = {
  id: implementationSnapshot.id,
  pbiId: implementationSnapshot.pbiId,
  version: implementationSnapshot.version,
  planVersion: implementationSnapshot.planVersion,
  runId: implementationSnapshot.runId,
  createdAt: implementationSnapshot.createdAt,
  build: implementationSnapshot.build,
};

// The PBI's latest implementation (the implementation agent's write_implementation); the inspect snapshot stays in the
// table for audits.
export async function latestBuild(db: PowerLoomDb, adoId: number): Promise<BuildVersion | null> {
  const [row] = await db.select(BUILD_COLUMNS).from(implementationSnapshot).where(eq(implementationSnapshot.pbiId, adoId)).orderBy(desc(implementationSnapshot.version)).limit(1);

  return row ?? null;
}

// One implementation version by its row id, as the result pages link it.
export async function buildById(db: PowerLoomDb, id: number): Promise<BuildVersion | null> {
  const [row] = await db.select(BUILD_COLUMNS).from(implementationSnapshot).where(eq(implementationSnapshot.id, id));

  return row ?? null;
}

// The implementation in a few lines, for a child item's parent block and reference titles.
export function buildLines(latest: BuildVersion): string[] {
  const { build } = latest;
  const plans = build.plans.map((plan) => `- ${plan.id}: ${plan.status} (${plan.tasksDone}/${plan.tasksTotal} tasks)`);

  return [
    `Build v${latest.version} on ${build.branch} (${build.handOver.state}): ${build.summary || "-"}`,
    `Commits: ${build.commits.length}; verification: ${build.handOver.verdict || "-"}`,
    "Plans:",
    ...(plans.length > 0 ? plans : ["- none"]),
  ];
}
