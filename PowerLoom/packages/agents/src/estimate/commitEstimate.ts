import { pbiEstimate, type PowerLoomDb } from "@powerloom/db";
import type { EstimateDraft } from "./models/EstimateDraft";
import { addRunOutputs } from "../tasks/runOutputs";

// Writes the run's estimate, when it recorded one, as a new row: earlier estimates stay as history.
export async function commitEstimate(db: PowerLoomDb, target: { pbiId: number | null; runId: number; agent: string }, estimate: EstimateDraft | null): Promise<void> {
  if (!estimate || target.pbiId === null) {
    return;
  }

  await db.insert(pbiEstimate).values({
    pbiId: target.pbiId,
    runId: target.runId,
    agent: target.agent,
    humanHours: String(estimate.humanHours),
    agentHours: String(estimate.agentHours),
    complexity: estimate.complexity,
    confidence: estimate.confidence,
    basis: estimate.basis,
  });
  await addRunOutputs(db, target.runId, [`PBI-${target.pbiId} estimate`]);
}
