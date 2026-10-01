import { localItem } from "@adoa/db";
import { and, asc, desc, eq, getTableColumns, inArray, isNull, ne, notInArray, sql, type SQL } from "drizzle-orm";
import type { TaskFilter } from "@/models/TaskFilter";
import { getDb } from "./db";

const OPEN_STATUSES: ("open" | "in-progress" | "blocked")[] = ["open", "in-progress", "blocked"];
const LIST_LIMIT = 300;

// The kinds the page lists; research results show inside their task.
export const TASK_KINDS = ["question", "human", "finding", "refinement", "research", "design", "docs"] as const;

// Every task, question and finding across PBIs, plus those without one (e.g. a chat draft's tech-writer task).
export async function loadTaskList(filter: TaskFilter) {
  return getDb()
    .select({ ...getTableColumns(localItem), latestRunId: latestRunId(), latestRunOutcome: latestRunOutcome() })
    .from(localItem)
    .where(and(...filterConditions(filter)))
    .orderBy(sortOrder(filter), desc(localItem.id))
    .limit(LIST_LIMIT);
}

// The run that last worked on the item (an agent task's run; questions and findings have none). The column is written
// out: inside a select, drizzle renders it as a bare "id", which the subquery would read as agent_run's own id.
function latestRunId(): SQL<number | null> {
  return sql<number | null>`(SELECT max(r.id)::int FROM agent_run r WHERE r.item_id = "local_item"."id")`;
}

function latestRunOutcome(): SQL<string | null> {
  return sql<string | null>`(SELECT r.outcome::text FROM agent_run r WHERE r.item_id = "local_item"."id" ORDER BY r.id DESC LIMIT 1)`;
}

function sortOrder(filter: TaskFilter): SQL {
  const column = filter.sort === "updated" ? localItem.updatedAt : localItem.createdAt;

  return filter.dir === "asc" ? asc(column) : desc(column);
}

function filterConditions(filter: TaskFilter): SQL[] {
  const conditions: SQL[] = [ne(localItem.kind, "research-result"), ne(localItem.status, "deleted")];
  const kind = TASK_KINDS.find((entry) => entry === filter.kind);

  if (kind) {
    conditions.push(eq(localItem.kind, kind));
  }

  if (filter.status !== "all") {
    conditions.push(filter.status === "open" ? inArray(localItem.status, OPEN_STATUSES) : notInArray(localItem.status, OPEN_STATUSES));
  }

  const pbi = pbiCondition(filter.pbi);

  return pbi ? [...conditions, pbi] : conditions;
}

function pbiCondition(pbi: string): SQL | null {
  if (pbi === "none") {
    return isNull(localItem.pbiId);
  }

  return /^\d+$/.test(pbi) ? eq(localItem.pbiId, Number(pbi)) : null;
}

export type TaskRow = Awaited<ReturnType<typeof loadTaskList>>[number];
