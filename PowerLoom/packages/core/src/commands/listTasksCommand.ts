import { z } from "zod";
import type { Command } from "../models/Command";
import type { TaskListRow } from "../models/TaskListRow";
import { TASK_KINDS, loadTaskList, matchesTask, sortTasks, toTaskListRow } from "../tasks/taskList";
import { TASK_BUCKETS } from "../tasks/taskLooks";
import { limitInput, periodInput, vaultInput } from "./inputs";

const input = z.object({
  vault: vaultInput,
  period: periodInput,
  pbi: z.string().trim().regex(/^(none|\d+)$/).optional().describe("A PBI's id for its tasks only, or \"none\" for tasks without a PBI"),
  kind: z.string().trim().min(1).optional().describe(`Only this kind of item: ${TASK_KINDS.join(", ")}, or a custom task type an agent handles`),
  status: z.enum([...TASK_BUCKETS, "all"]).default("all").describe("What the task waits for, as the page's pills: you, held, open, done, cancelled, or all"),
  limit: limitInput(500, 100),
});

type ListTasksInput = z.infer<typeof input>;

export const listTasksCommand: Command<ListTasksInput, TaskListRow[]> = {
  name: "task.list",
  effect: "read",
  description: "List a vault's tasks, questions and findings created in the period, as the Tasks page does: what waits on you first, then the latest change. Filter by PBI, kind or status; pass an id (RT-…, Q-…, HT-…, F-…) to task_get for the body.",
  input,
  async run(context, input) {
    const rows = await loadTaskList(context.db, { pbi: input.pbi ?? "", range: input.period }, input.vault);
    const filter = { kind: input.kind ?? "", status: input.status };
    const tasks = sortTasks(rows).filter((row) => matchesTask(row, filter)).slice(0, input.limit).map(toTaskListRow);

    return { ok: true, value: tasks };
  },
};
