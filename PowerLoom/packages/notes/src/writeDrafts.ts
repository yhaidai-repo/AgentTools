import { createHumanTask, draftKey, vaultOfPbi } from "@powerloom/core";
import { vaultCapture, type PowerLoomDb } from "@powerloom/db";
import { and, eq } from "drizzle-orm";
import { VaultCaptureCli } from "./VaultCaptureCli";

type CaptureRow = typeof vaultCapture.$inferSelect;

// Saves the PBI's pending drafts through the VaultCapture module. None may stay pending: each ends written
// (it then blocks the other agents until merged), or rejected and handed to the user as a human task.
export async function writeDrafts(db: PowerLoomDb, adoId: number): Promise<void> {
  const pending = await db.select().from(vaultCapture).where(and(eq(vaultCapture.pbiId, adoId), eq(vaultCapture.status, "pending")));

  if (pending.length === 0) {
    return;
  }

  const vault = await vaultOfPbi(db, adoId);

  if (!vault) {
    throw new Error(`PBI-${adoId} has ${pending.length} vault draft(s) to write, but isn't in PowerLoom`);
  }

  const cli = await VaultCaptureCli.forVault(vault, `PBI-${adoId} has ${pending.length} vault draft(s) to write`);

  for (const capture of pending) {
    await saveDraft(db, cli, capture);
  }
}

async function saveDraft(db: PowerLoomDb, cli: VaultCaptureCli, capture: CaptureRow): Promise<void> {
  const result = await cli.capture({
    vault: cli.vaultName,
    project: capture.project,
    name: capture.name,
    title: capture.title,
    source: `session finding: powerloom ${capture.itemId ?? "agent"} run RUN-${capture.runId} (PBI-${capture.pbiId})`,
    target: capture.target,
    captured: capture.captured,
    assumptions: capture.assumptions,
    toFill: capture.toFill,
  });
  const filePath = result.ok && result.path ? cli.relativePath(result.path) : null;

  const taskId = await db.transaction(async (tx) => {
    // Claim the pending transition under a row lock; another publisher can no longer create a second handover.
    const [claimed] = await tx.update(vaultCapture).set({ status: result.mode, errors: result.errors, filePath })
      .where(and(eq(vaultCapture.id, capture.id), eq(vaultCapture.status, "pending"))).returning();
    if (claimed && !result.ok) return handOver(tx, claimed, result.errors);
    // A failed handover rolls the status back to pending, so the next normal writeDrafts run retries it.
    return null;
  });
  if (taskId) console.error(`VaultCapture rejected CAP-${capture.id} (${capture.name}): ${result.errors.join("; ")}; handed to the user as ${taskId}`);
}

// The draft will never be written, so the person gets a task (which blocks the agents) with the reasons and the facts to save by hand.
async function handOver(db: PowerLoomDb, capture: CaptureRow, errors: string[]): Promise<string> {
  const facts = capture.captured.map((fact) => `- ${fact}`).join("\n");
  return createHumanTask(db, {
    adoId: capture.pbiId,
    title: `Fix the rejected vault draft "${capture.name}"`,
    body: `VaultCapture rejected the draft CAP-${capture.id} (target ${capture.target}):\n${errors.map((error) => `- ${error}`).join("\n")}\n\nCaptured facts:\n${facts}\n\nSave them in the docs vault by hand (or decide they aren't needed), then close this task.`,
    runId: capture.runId,
    data: { captureId: capture.id, key: draftKey(capture.id) },
  });
}
