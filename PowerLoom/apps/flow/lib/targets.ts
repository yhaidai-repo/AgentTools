import { RESULT_KINDS } from "@powerloom/core";
import { localItem, workItem } from "@powerloom/db";
import { and, desc, eq, inArray, notInArray } from "drizzle-orm";
import { getDb } from "./db";

// What a flow can run for (the Run dialog): the vault's PBIs and its open tasks. The queries are the minimal cut of
// the web's backlog and task list reads (core's loadBacklogRows, loadTaskList); phase 4's Project entity narrows them.

export interface PbiTarget {
  pbiId: number;
  title: string;
  status: string;
  type: string;
}

export interface TaskTarget {
  itemId: string;
  title: string;
  kind: string;
  status: string;
  pbiId: number | null;
}

export interface RunTargets {
  pbis: PbiTarget[];
  tasks: TaskTarget[];
}

const PBI_LIMIT = 500;
const TASK_LIMIT = 200;

export async function loadRunTargets(vault: string): Promise<RunTargets> {
  const db = getDb();
  const [pbis, tasks] = await Promise.all([
    db.select({ pbiId: workItem.adoId, title: workItem.title, status: workItem.pipelineStatus, type: workItem.type }).from(workItem).where(eq(workItem.vault, vault)).orderBy(desc(workItem.adoId)).limit(PBI_LIMIT),
    db
      .select({ itemId: localItem.id, title: localItem.title, kind: localItem.kind, status: localItem.status, pbiId: localItem.pbiId })
      .from(localItem)
      .where(and(eq(localItem.vault, vault), inArray(localItem.status, ["open", "in-progress"]), notInArray(localItem.kind, RESULT_KINDS)))
      .orderBy(desc(localItem.updatedAt), desc(localItem.id))
      .limit(TASK_LIMIT),
  ]);

  return { pbis, tasks };
}
