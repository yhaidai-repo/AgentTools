import { localItem } from "@adoa/db";
import { and, desc, eq, inArray, isNull, ne, notInArray, type SQL } from "drizzle-orm";
import type { TaskFilter } from "@/models/TaskFilter";
import { getDb } from "./db";

const OPEN_STATUSES: ("open" | "in-progress" | "blocked")[] = ["open", "in-progress", "blocked"];
const LIST_LIMIT = 300;

// The kinds the page lists; research results show inside their task.
export const TASK_KINDS = ["question", "human", "finding", "refinement", "research", "design", "docs"] as const;

// Every task, question and finding across PBIs, plus those without one (e.g. a chat draft's tech-writer task).
export async function loadTaskList(filter: TaskFilter) {
  return getDb().select().from(localItem).where(and(...filterConditions(filter))).orderBy(desc(localItem.createdAt)).limit(LIST_LIMIT);
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
