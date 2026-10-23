import { z } from "zod";
import type { Command } from "../models/Command";
import type { TaskSchedule } from "../models/TaskSchedule";
import { listVaultTaskSchedules } from "../taskSchedules";
import { vaultInput } from "./inputs";

const input = z.object({ vault: vaultInput });

export const listSchedulesCommand: Command<{ vault: string }, TaskSchedule[]> = {
  name: "schedule.list",
  effect: "read",
  description: "List a vault's scheduled tasks as the Tasks page shows them: name, agent, cron, the task params each tick creates, enabled, and what the last tick did. Pass an id to schedule.get for one.",
  input,
  async run(context, input) {
    const schedules = await listVaultTaskSchedules(context.db, input.vault);

    return { ok: true, value: schedules };
  },
};
