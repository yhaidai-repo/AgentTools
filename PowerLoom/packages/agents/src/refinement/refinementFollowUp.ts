import { ANY_AGENT, insertHandoff, nextItemId, vaultOfPbiSql, type NewHandoff } from "@powerloom/core";
import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, eq, inArray, ne } from "drizzle-orm";
import type { RefinementFollowUp } from "./models/RefinementFollowUp";

const TITLE = "Refine the PBI again with the answers";
const OPEN_STATUSES = ["open", "in-progress"] as const;

// A refinement run that hands questions or tasks to the user is followed by a refinement task that waits for them
// (dependsOn; it also waits for the run's research tasks) and starts once they are closed: it reads the answers, updates
// the refinement and hands on to design (user decision 2026-10-15). Not when the run queued design itself, nor when
// another refinement task is open on the PBI. Returns the new task's id, or null.
export async function queueRefinementFollowUp(db: PowerLoomDb, followUp: RefinementFollowUp): Promise<string | null> {
  const dependsOn = followUpDependsOn(followUp);

  if (dependsOn.length === 0 || (await otherOpenRefinement(db, followUp.pbiId, followUp.taskId)) !== null) {
    return null;
  }

  return insertFollowUp(db, followUp, dependsOn);
}

// Better Refinement's follow-up as a hand-off (user decision 2026-10-28): the refinement task that carries the run's
// work on, the new follow-up or the one already open, gets a continue hand-off from the run's task, so the settlement
// ends that task done. Returns the new follow-up's id, or null.
export async function handOnRefinement(db: PowerLoomDb, followUp: RefinementFollowUp & { taskId: string }, agent: string, version: number): Promise<string | null> {
  const dependsOn = followUpDependsOn(followUp);

  if (dependsOn.length === 0) {
    return null;
  }

  const open = await otherOpenRefinement(db, followUp.pbiId, followUp.taskId);
  const id = open ?? (await insertFollowUp(db, followUp, dependsOn));

  await insertHandoff(db, followUpHandoff(followUp, agent, version, dependsOn), id);

  return open === null ? id : null;
}

function followUpHandoff(followUp: RefinementFollowUp & { taskId: string }, agent: string, version: number, dependsOn: string[]): NewHandoff {
  const body = `Refinement v${version} handed questions and tasks on. Once they are closed, refine the PBI again with their answers and hand on to planning.`;

  return { from: { taskId: followUp.taskId, agent, runId: followUp.runId }, toKind: "agent", intent: "continue", gate: "none", package: { body, refs: { results: [`RUN-${followUp.runId}`], items: dependsOn, notes: [] } } };
}

// The items the follow-up waits for; none when no follow-up is needed.
export function followUpDependsOn(followUp: RefinementFollowUp): string[] {
  const isNeeded = followUp.userItemIds.length > 0 && !followUp.designQueued;

  return isNeeded ? [...followUp.userItemIds, ...followUp.agentItemIds] : [];
}

async function otherOpenRefinement(db: PowerLoomDb, pbiId: number, taskId: string | null): Promise<string | null> {
  const conditions = [eq(localItem.pbiId, pbiId), eq(localItem.kind, "refinement"), inArray(localItem.status, [...OPEN_STATUSES])];
  const others = taskId === null ? conditions : [...conditions, ne(localItem.id, taskId)];
  const [row] = await db.select({ id: localItem.id }).from(localItem).where(and(...others)).limit(1);

  return row?.id ?? null;
}

async function insertFollowUp(db: PowerLoomDb, followUp: RefinementFollowUp, dependsOn: string[]): Promise<string> {
  const id = await nextItemId(db, "RT", followUp.pbiId);
  const body = `Starts once ${dependsOn.join(", ")} are closed: rerun refinement with their answers.`;

  await db.insert(localItem).values({
    id, kind: "refinement", pbiId: followUp.pbiId, vault: vaultOfPbiSql(followUp.pbiId), title: TITLE, status: "open", assignee: ANY_AGENT,
    body, data: { dependsOn }, createdByRun: followUp.runId,
  });

  return id;
}
