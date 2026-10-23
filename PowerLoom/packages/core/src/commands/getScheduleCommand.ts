import { z } from "zod";
import type { Command } from "../models/Command";
import type { TaskSchedule } from "../models/TaskSchedule";
import { readTaskSchedule } from "../taskSchedules";
import { vaultInput } from "./inputs";

const input = z.object({
  id: z.number().int().positive().describe("The schedule's id, as schedule.list gives it"),
  vault: vaultInput,
});

type GetScheduleInput = z.infer<typeof input>;

export const getScheduleCommand: Command<GetScheduleInput, TaskSchedule> = {
  name: "schedule.get",
  effect: "read",
  description: "Read one scheduled task by its id: name, agent, cron, the task params each tick creates, enabled, and the last tick's time and result.",
  input,
  async run(context, input) {
    const schedule = await readTaskSchedule(context.db, input.id);

    if (!schedule) {
      return { ok: false, error: `Schedule ${input.id} isn't in PowerLoom.` };
    }

    if (schedule.vault !== input.vault) {
      return { ok: false, error: `Schedule ${input.id} isn't in vault ${input.vault}: it belongs to ${schedule.vault}.` };
    }

    return { ok: true, value: schedule };
  },
};
