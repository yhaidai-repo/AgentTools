import { setItemStatus } from "@powerloom/core";
import { agentRun, design, localItem, type PowerLoomDb } from "@powerloom/db";
import { desc, eq } from "drizzle-orm";
import { commitRelevantPages } from "../relevantPages";
import { commitCaptures } from "../vaultCapture";
import { insertGapItems } from "./gapItems";
import type { DesignDraft } from "./models/DesignDraft";
import type { DesignOutput } from "./models/DesignOutput";

type ItemRow = typeof localItem.$inferSelect;

const ACTOR = "agent:design";

// Writes a successful run: the design (when there is one), questions and tasks for the user, drafts, pages. With a
// design the task is done; without one it waits, open, until its gaps close, then design runs again (user decision 2026-10-02).
export async function commitDesign(db: PowerLoomDb, task: ItemRow, adoId: number, runId: number, draft: DesignDraft): Promise<string[]> {
  const designIds = draft.design ? [await insertDesign(db, adoId, runId, draft.design)] : [];
  const gapIds = await insertGapItems(db, adoId, task.id, runId, draft.gaps);
  const captureIds = await commitCaptures(db, runId, adoId, task.id, draft.captures);
  const outputs = [...designIds, ...gapIds, ...captureIds];

  await commitRelevantPages(db, adoId, draft.pages, "design");
  await db.update(agentRun).set({ outputs }).where(eq(agentRun.id, runId));

  if (draft.design) {
    await setItemStatus(db, task.id, "in-progress", "done", ACTOR, runId);

    return outputs;
  }

  await db.update(localItem).set({ heldBy: [`Design needs input first: ${gapIds.join(", ")}`] }).where(eq(localItem.id, task.id));
  await setItemStatus(db, task.id, "in-progress", "open", ACTOR, runId);

  return outputs;
}

async function insertDesign(db: PowerLoomDb, adoId: number, runId: number, output: DesignOutput): Promise<string> {
  const [latest] = await db.select({ version: design.version }).from(design).where(eq(design.pbiId, adoId)).orderBy(desc(design.version)).limit(1);
  const version = (latest?.version ?? 0) + 1;

  await db.insert(design).values({
    pbiId: adoId,
    version,
    estHumanH: String(output.estimate.humanHours),
    estAgentH: String(output.estimate.agentHours),
    complexity: output.estimate.complexity,
    confidence: output.estimate.confidence,
    riskCount: output.risks.length,
    testCount: output.tests.length,
    approach: output.approach,
    alternatives: output.alternatives,
    plan: output.plan,
    risks: output.risks,
    tests: output.tests,
    assumptions: output.assumptions,
    estimateBasis: output.estimate.basis,
    runId,
  });

  return `design v${version}`;
}
