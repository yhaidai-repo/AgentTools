import { localItem, type PowerLoomDb } from "@powerloom/db";
import { inArray, sql } from "drizzle-orm";
import type { CreatedTask } from "../taskCreation/models/CreatedTask";
import { USER } from "../taskCreation/taskTargets";

const CARRIES_ON = ["continue", "return"];

// A run that hands its work on and also asks something ends done (settleTask), so nothing of its own waits for the
// answers: the agent tasks that carry the work on wait for them instead (their data.dependsOn, which the dispatcher
// checks). Runs once every task of the run is written; the set union keeps a resumed commit from adding an id twice.
export async function joinAskedToReceivers(db: PowerLoomDb, tasks: CreatedTask[], taskIds: string[]): Promise<void> {
  const asked = idsWhere(tasks, taskIds, (task) => task.handoff?.intent === "ask");
  const receivers = idsWhere(tasks, taskIds, isAgentReceiver);

  if (asked.length === 0 || receivers.length === 0) {
    return;
  }

  await db.update(localItem).set({ data: withDependencies(asked) }).where(inArray(localItem.id, receivers));
}

function isAgentReceiver(task: CreatedTask): boolean {
  return task.assignee !== USER && CARRIES_ON.includes(task.handoff?.intent ?? "");
}

function idsWhere(tasks: CreatedTask[], taskIds: string[], matches: (task: CreatedTask) => boolean): string[] {
  return tasks.flatMap((task, index) => (matches(task) && taskIds[index] ? [taskIds[index]] : []));
}

function withDependencies(ids: string[]) {
  return sql`jsonb_set(coalesce(${localItem.data}, '{}'::jsonb), '{dependsOn}', (
    select coalesce(jsonb_agg(distinct id), '[]'::jsonb)
    from jsonb_array_elements_text(coalesce(${localItem.data}->'dependsOn', '[]'::jsonb) || ${JSON.stringify(ids)}::jsonb) as id))`;
}
