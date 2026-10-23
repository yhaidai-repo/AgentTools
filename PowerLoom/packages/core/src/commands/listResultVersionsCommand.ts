import { agentRun, localItem, type PowerLoomDb } from "@powerloom/db";
import { eq } from "drizzle-orm";
import { z } from "zod";
import type { Command } from "../models/Command";
import type { Outcome } from "../models/Outcome";
import type { ResultSet } from "../models/ResultSet";
import type { ResultSetSummary } from "../models/ResultSetSummary";
import { toResultSetSummaries } from "../results/resultReads";
import { vaultOfPr } from "../results/resultVault";
import { loadPbiResultSets, loadReviewResultSet, loadTaskResultSets } from "../results/resultVersions";
import { vaultOfPbi } from "../vaults";
import { pbiIdInput, vaultInput } from "./inputs";

type ListResultVersionsInput = { vault: string; pbiId?: number; taskId?: string; prId?: number };

const input = z
  .object({
    vault: vaultInput,
    pbiId: pbiIdInput.optional(),
    taskId: z.string().trim().min(1).optional().describe("A task's id, e.g. RT-38519-003: its runs' results"),
    prId: z.number().int().positive().optional().describe("A pull request's id: its review runs"),
  })
  .refine((value) => [value.pbiId, value.taskId, value.prId].filter((id) => id !== undefined).length === 1, { message: "Pass exactly one of pbiId, taskId or prId." });

export const listResultVersionsCommand: Command<ListResultVersionsInput, ResultSetSummary[]> = {
  name: "result.versions",
  effect: "read",
  description: "List every result version of one PBI (its estimates, refinements, designs and each task's results), one task (what its runs wrote) or one pull request (its review runs), oldest first with the latest marked. Pass a version's kind and id to result.get.",
  input,
  async run(context, input) {
    const sets = await setsOf(context.db, input);

    return sets.ok ? { ok: true, value: toResultSetSummaries(sets.value) } : sets;
  },
};

function setsOf(db: PowerLoomDb, input: ListResultVersionsInput): Promise<Outcome<ResultSet[]>> {
  if (input.pbiId !== undefined) {
    return pbiSets(db, input.pbiId, input.vault);
  }

  if (input.taskId !== undefined) {
    return taskSets(db, input.taskId, input.vault);
  }

  return prSets(db, input.prId!, input.vault);
}

async function pbiSets(db: PowerLoomDb, pbiId: number, vault: string): Promise<Outcome<ResultSet[]>> {
  if ((await vaultOfPbi(db, pbiId)) !== vault) {
    return { ok: false, error: `PBI-${pbiId} isn't in vault ${vault}.` };
  }

  return { ok: true, value: await loadPbiResultSets(db, pbiId) };
}

// The task's page lists the results of its runs (loadTaskResultSets), so its run ids come first.
async function taskSets(db: PowerLoomDb, taskId: string, vault: string): Promise<Outcome<ResultSet[]>> {
  const [task] = await db.select({ id: localItem.id, pbiId: localItem.pbiId, kind: localItem.kind, data: localItem.data, vault: localItem.vault }).from(localItem).where(eq(localItem.id, taskId));

  if (!task || task.vault !== vault) {
    return { ok: false, error: `${taskId} isn't in vault ${vault}.` };
  }

  const runs = await db.select({ id: agentRun.id }).from(agentRun).where(eq(agentRun.itemId, taskId));

  return { ok: true, value: await loadTaskResultSets(db, task, runs.map((run) => run.id)) };
}

async function prSets(db: PowerLoomDb, prId: number, vault: string): Promise<Outcome<ResultSet[]>> {
  if ((await vaultOfPr(db, prId)) !== vault) {
    return { ok: false, error: `Pull request ${prId} isn't in vault ${vault}.` };
  }

  return { ok: true, value: [await loadReviewResultSet(db, prId)] };
}
