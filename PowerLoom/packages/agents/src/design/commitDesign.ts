import { design, localItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { commitCaptures } from "../vaultCapture";
import { addRunOutputs } from "../tasks/runOutputs";
import { insertGapItems } from "./gapItems";
import type { DesignDraft } from "./models/DesignDraft";
import type { DesignOutput } from "./models/DesignOutput";

type ItemRow = typeof localItem.$inferSelect;

// Writes a successful run: the design (when there is one), questions and tasks for the user, drafts, pages. Returns the
// gap items: without a design the task waits until they close, then design runs again (user decision 2026-10-02; the
// generic executor settles the task).
export async function commitDesign(db: PowerLoomDb, task: ItemRow, adoId: number, runId: number, draft: DesignDraft): Promise<{ gapIds: string[] }> {
  const designIds = draft.design ? [await insertDesign(db, adoId, runId, draft.design)] : [];
  const gapIds = await insertGapItems(db, adoId, task.id, runId, draft.gaps);
  const captureIds = await commitCaptures(db, runId, adoId, task.id, draft.captures);
  const outputs = [...designIds, ...gapIds, ...captureIds];

  await commitRelevantPages(db, adoId, draft.pages, "design");
  await addRunOutputs(db, runId, outputs);

  return { gapIds };
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
