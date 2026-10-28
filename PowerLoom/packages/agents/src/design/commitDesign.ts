import { design, localItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { commitCaptures } from "../vaultCapture";
import { addRunOutputs } from "../tasks/runOutputs";
import type { DesignDraft } from "./models/DesignDraft";
import type { DesignOutput } from "./models/DesignOutput";

type ItemRow = typeof localItem.$inferSelect;

// Writes a successful run: the design (when there is one), drafts, pages. What stops a design went to the user with
// hand_off (user decision 2026-10-28): the task waits for it, then design runs again (the generic executor settles it).
export async function commitDesign(db: PowerLoomDb, task: ItemRow, adoId: number, runId: number, draft: DesignDraft): Promise<void> {
  const designIds = draft.design ? [await insertDesign(db, adoId, runId, draft.design)] : [];
  const captureIds = await commitCaptures(db, runId, adoId, task.id, draft.captures);

  await commitRelevantPages(db, adoId, draft.pages, "design");
  await addRunOutputs(db, runId, [...designIds, ...captureIds]);
}

async function insertDesign(db: PowerLoomDb, adoId: number, runId: number, output: DesignOutput): Promise<string> {
  const [latest] = await db.select({ version: design.version }).from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;

  await db.insert(design).values({
    pbiId: adoId,
    version,
    riskCount: output.risks.length,
    testCount: output.tests.length,
    approach: output.approach,
    alternatives: output.alternatives,
    plan: output.plan,
    risks: output.risks,
    tests: output.tests,
    assumptions: output.assumptions,
    runId,
  });

  return `design v${version}`;
}
