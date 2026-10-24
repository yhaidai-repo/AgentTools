import { z } from "zod";
import type { Command } from "../models/Command";
import type { CommandContext } from "../models/CommandContext";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";
import { taskFields } from "./taskFields";

interface CreateTaskInput {
  vault: string;
  type: string;
  title: string;
  description: string;
  acceptanceCriteria: string;
  pbi: string | null;
  repos: string[];
  cron: string | null;
  enabled: boolean;
}

interface CreatedTaskOrSchedule {
  taskId: string | null;
  pbiId: number | null;
  scheduleId: number | null;
  message: string;
}

// The Tasks page's New task: one task now, or with a cron a schedule by task type (user decision 2026-10-14).
export const createTaskCommand: Command<CreateTaskInput, CreatedTaskOrSchedule> = {
  name: "task.create",
  description: "Create a task for any agent taking its type (the Tasks page's New task), or with a cron a schedule that creates it on each tick (none while the last one still waits). PowerLoom checks it against its type (PBI, repos). Ask the user for the type (offer the types this tool lists), the one-line title, what to do and when it is done, and the PBI where the type needs one; never invent them. Show the user the task before creating it.",
  input: z.object({
    vault: vaultInput,
    ...taskFields,
    cron: z.string().trim().min(1).nullable().default(null).describe("Optional cron, e.g. 0 7 * * 1: a schedule instead of one task now"),
    enabled: z.boolean().default(true).describe("A schedule's switch (off: only schedule.tick creates its task)"),
  }),
  async run(context, input) {
    return input.cron === null ? createTask(context, input) : createSchedule(context, input, input.cron);
  },
};

async function createTask(context: CommandContext, input: CreateTaskInput) {
  const created = await context.powerloom.createTask({ vault: input.vault, type: input.type, title: input.title, description: input.description, acceptanceCriteria: input.acceptanceCriteria, pbi: input.pbi, repos: input.repos }, context.actor);

  return mapOutcome(created, (task): CreatedTaskOrSchedule => ({ taskId: task.id, pbiId: task.pbiId, scheduleId: null, message: `${task.id} created; an agent taking ${input.type} tasks picks it up.` }));
}

async function createSchedule(context: CommandContext, input: CreateTaskInput, cron: string) {
  const saved = await context.powerloom.saveSchedule({ id: null, name: input.title, vault: input.vault, cron, enabled: input.enabled, taskType: input.type, description: input.description, acceptanceCriteria: input.acceptanceCriteria, pbi: input.pbi, repos: input.repos });

  return mapOutcome(saved, (schedule): CreatedTaskOrSchedule => ({ taskId: null, pbiId: null, scheduleId: schedule.id, message: `Schedule ${schedule.id} "${schedule.name}" saved (${schedule.cron}${schedule.enabled ? "" : ", off"}).` }));
}
