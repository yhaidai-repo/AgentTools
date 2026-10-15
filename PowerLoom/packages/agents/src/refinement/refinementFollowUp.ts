import { ANY_AGENT, nextItemId, vaultOfPbiSql } from "@powerloom/core";
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

  if (dependsOn.length === 0 || (await hasOtherOpenRefinement(db, followUp.pbiId, followUp.taskId))) {
    return null;
  }

  return insertFollowUp(db, followUp, dependsOn);
}

// The items the follow-up waits for; none when no follow-up is needed.
export function followUpDependsOn(followUp: RefinementFollowUp): string[] {
  const isNeeded = followUp.userItemIds.length > 0 && !followUp.designQueued;

  return isNeeded ? [...followUp.userItemIds, ...followUp.agentItemIds] : [];
}

async function hasOtherOpenRefinement(db: PowerLoomDb, pbiId: number, taskId: string | null): Promise<boolean> {
  const conditions = [eq(localItem.pbiId, pbiId), eq(localItem.kind, "refinement"), inArray(localItem.status, [...OPEN_STATUSES])];
  const others = taskId === null ? conditions : [...conditions, ne(localItem.id, taskId)];
  const rows = await db.select({ id: localItem.id }).from(localItem).where(and(...others)).limit(1);

  return rows.length > 0;
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
