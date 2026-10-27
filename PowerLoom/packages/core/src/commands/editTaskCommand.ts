import { z } from "zod";
import type { Command } from "../models/Command";
import type { TaskEdit } from "../models/TaskEdit";
import { mapOutcome } from "./mapOutcome";

// Edit on an agent task's page (user decision 2026-10-26): its text, whenever it isn't running.
export const editTaskCommand: Command<TaskEdit, { itemId: string }> = {
  name: "task.edit",
  description: "Change an agent task's title, description and acceptance criteria (all three, as the New task form takes them) while it isn't running: open, blocked or done. It doesn't run the task again; task_rerun does. Read it with task_get first, show the user the new text and save after their yes.",
  input: z.object({
    adoId: z.number().int().positive().nullable().describe("The task's PBI, or null for a task without one"),
    itemId: z.string().trim().min(1),
    title: z.string().trim().min(1).max(120),
    description: z.string().trim().min(1).max(4000),
    acceptanceCriteria: z.string().trim().min(1).max(4000),
  }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.editTask(input), (itemId) => ({ itemId }));
  },
};
