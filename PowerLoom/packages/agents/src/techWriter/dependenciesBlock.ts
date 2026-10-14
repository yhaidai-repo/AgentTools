import { localItem, type PowerLoomDb } from "@powerloom/db";
import { and, asc, eq, inArray } from "drizzle-orm";
import { resultBlock } from "../research/researchResultBlock";
import { dependenciesOf } from "../tasks/waiting";

type ItemRow = typeof localItem.$inferSelect;

// What the items a tech-writer task waited for came back with (user decision 2026-10-14): each with its status, a
// research task's final results, a question's or human task's answer. Empty when the task waited for nothing.
export async function dependenciesBlock(db: PowerLoomDb, task: ItemRow): Promise<string> {
  const ids = dependenciesOf(task);

  if (ids.length === 0) {
    return "";
  }

  const items = await db.select().from(localItem).where(inArray(localItem.id, ids)).orderBy(asc(localItem.id));
  const results = await db
    .select()
    .from(localItem)
    .where(and(inArray(localItem.parentId, ids), eq(localItem.kind, "research-result"), eq(localItem.status, "final")))
    .orderBy(asc(localItem.id));

  return ["<dependencies>", "What the tasks you handed on in an earlier run came back with:", ...items.map((item) => dependencyBlock(item, results)), "</dependencies>"].join("\n");
}

export function dependencyBlock(item: ItemRow, results: ItemRow[]): string {
  const head = `## ${item.id} (${item.kind}, ${item.status}): ${item.title}`;
  const own = results.filter((result) => result.parentId === item.id);

  if (own.length > 0) {
    return [head, ...own.map((result) => resultBlock(result, item))].join("\n");
  }

  return [head, item.resolution ? `Answer: ${item.resolution}` : "No result was recorded."].join("\n");
}
