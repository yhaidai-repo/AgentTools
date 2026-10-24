import { localItem } from "@powerloom/db";
import type { TaskContext } from "../models/TaskContext";
import { numberOption } from "../stage";
import { countAgentCreatedTasks } from "../taskCreation/commitCreatedTasks";
import type { TaskCreationLimits } from "../taskCreation/models/TaskCreationLimits";

type ItemRow = typeof localItem.$inferSelect;

export async function taskLimits(context: TaskContext, pbiId: number | null, depth: number): Promise<TaskCreationLimits> {
  const { agent, deps } = context;

  return {
    depth,
    maxDepth: numberOption(agent, "maxDepth", 3),
    maxPerRun: numberOption(agent, "maxTasksPerRun", 5),
    maxPerPbi: numberOption(agent, "maxTasksPerPbi", 15),
    createdOnPbi: pbiId === null ? 0 : await countAgentCreatedTasks(deps.db, pbiId),
  };
}

export function depthOf(task: ItemRow): number {
  return Number((task.data as { depth?: number } | null)?.depth ?? 1);
}
