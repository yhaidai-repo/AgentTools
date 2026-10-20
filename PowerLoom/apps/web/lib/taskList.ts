import { localItem } from "@powerloom/db";
import { and, desc, eq, getTableColumns, gte, isNull, ne, notInArray, sql, type SQL } from "drizzle-orm";
import type { TaskFilter } from "@/models/TaskFilter";
import { getDb } from "./db";
import { periodStart } from "./periodStart";
import { taskBucket, type TaskBucket } from "./taskLooks";
import { RESULT_KINDS } from "./items";

const LIST_LIMIT = 500;

// The kinds the page lists; research results show inside their task.
export const TASK_KINDS = ["question", "human", "finding", "refinement", "research", "design", "docs", "review", "vault-review", "goal", "meeting", "test"] as const;

export const TASK_PAGE_SIZES = [25, 50, 100];

// Every task, question and finding of the vault in the period, across its PBIs plus those without one (e.g. a chat
// draft's tech-writer task), latest change first. The kind and status pills count and filter these in the page.
export async function loadTaskList(filter: Pick<TaskFilter, "pbi" | "range">, vault: string) {
  const since = await periodStart(filter.range, vault);

  return getDb()
    .select({ ...getTableColumns(localItem), runs: taskRuns() })
    .from(localItem)
    .where(and(eq(localItem.vault, vault), ...baseConditions(filter.pbi, since)))
    .orderBy(desc(localItem.updatedAt), desc(localItem.id))
    .limit(LIST_LIMIT);
}

export type TaskRow = Awaited<ReturnType<typeof loadTaskList>>[number];

// What waits on you comes first, then the latest change (user decision 2026-10-18); the query already sorts by change.
export function sortTasks(rows: TaskRow[]): TaskRow[] {
  return [...rows].sort((a, b) => Number(taskBucket(b) === "you") - Number(taskBucket(a) === "you"));
}

export function matchesTask(row: TaskRow, filter: Pick<TaskFilter, "kind" | "status">): boolean {
  return (filter.kind === "" || row.kind === filter.kind) && (filter.status === "all" || taskBucket(row) === filter.status);
}

export function countBy(rows: TaskRow[], key: (row: TaskRow) => string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  }

  return counts;
}

export function bucketOf(row: TaskRow): TaskBucket {
  return taskBucket(row);
}

// Every run that worked on the item, newest first (agent tasks; questions and findings have none). The column is written
// out: inside a select, drizzle renders it as a bare "id", which the subquery would read as agent_run's own id.
function taskRuns(): SQL<{ id: number; outcome: string }[]> {
  return sql<{ id: number; outcome: string }[]>`(SELECT coalesce(json_agg(json_build_object('id', r.id, 'outcome', r.outcome) ORDER BY r.id DESC), '[]'::json) FROM agent_run r WHERE r.item_id = "local_item"."id")`;
}

function baseConditions(pbiFilter: string, since: Date): SQL[] {
  const conditions: SQL[] = [notInArray(localItem.kind, RESULT_KINDS), ne(localItem.status, "deleted"), gte(localItem.createdAt, since)];
  const pbi = pbiCondition(pbiFilter);

  return pbi ? [...conditions, pbi] : conditions;
}

function pbiCondition(pbi: string): SQL | null {
  if (pbi === "none") {
    return isNull(localItem.pbiId);
  }

  return /^\d+$/.test(pbi) ? eq(localItem.pbiId, Number(pbi)) : null;
}
