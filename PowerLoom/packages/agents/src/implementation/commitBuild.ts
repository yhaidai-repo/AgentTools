import { implementationSnapshot, localItem, type BuildContent, type PowerLoomDb } from "@powerloom/db";
import { desc, eq, sql } from "drizzle-orm";
import { INSPECT_SCHEMA_VERSION } from "../planning/readPlan";
import { addRunOutputs } from "../tasks/runOutputs";
import { handOverBlock } from "./handOverPackage";

// Writes a successful run's build as the PBI's next version, with the inspect snapshot it was read from.
export async function commitBuild(db: PowerLoomDb, adoId: number, runId: number, build: { content: BuildContent; inspect: unknown }): Promise<void> {
  const [latest] = await db.select({ version: implementationSnapshot.version }).from(implementationSnapshot).where(eq(implementationSnapshot.pbiId, adoId)).orderBy(desc(implementationSnapshot.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;

  await db.insert(implementationSnapshot).values({ pbiId: adoId, version, schemaVersion: INSPECT_SCHEMA_VERSION, inspect: build.inspect, build: build.content, planVersion: build.content.planVersion, runId });
  await addRunOutputs(db, runId, [`build v${version}`]);
}

// The hand-over task gets the branch, its worktree and the pull request description above what the agent wrote, so the
// person has them whatever the package says.
export async function noteHandOver(db: PowerLoomDb, taskId: string, build: BuildContent): Promise<void> {
  await db.update(localItem).set({ body: sql`${handOverBlock(build)} || E'\\n\\n' || coalesce(${localItem.body}, '')` }).where(eq(localItem.id, taskId));
}

// Why the worktree is held: the hand-over task that keeps it until it closes.
export function holdReason(handOverId: string): string {
  return `PowerLoom: ${handOverId} (review the branch, push, open the pull request) keeps this worktree until it closes`;
}
