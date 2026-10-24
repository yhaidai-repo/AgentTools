import { z } from "zod";
import type { Command } from "../models/Command";
import type { SavedSchedule } from "../models/SavedSchedule";
import { readTaskSchedule } from "../taskSchedules";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";
import { taskFields } from "./taskFields";

interface SaveScheduleInput {
  id: number | null;
  vault: string | null;
  name: string;
  cron: string;
  enabled: boolean;
  type: string;
  description: string;
  acceptanceCriteria: string;
  pbi: string | null;
  repos: string[];
}

// The schedule page's Save: a schedule by task type. An existing schedule keeps its vault.
export const saveScheduleCommand: Command<SaveScheduleInput, SavedSchedule> = {
  name: "schedule.save",
  description: "Create or change a schedule by task type: on its cron it creates the described task for any agent taking the type, none while the last one still waits. Read it first with schedule_get when changing one. Ask the user for whatever they didn't say (name, cron, type, what to do, when it is done, the PBI where the type needs one) and show them the schedule before saving.",
  input: z.object({
    id: z.number().int().positive().nullable().default(null).describe("The schedule to change (schedule_list); null for a new one"),
    vault: vaultInput.nullable().default(null).describe("A new schedule's vault; a changed one keeps its own"),
    name: z.string().trim().min(1).max(120).describe("The schedule's name, also its tasks' title"),
    cron: z.string().trim().min(1).describe("When it ticks, e.g. 0 7 * * 1"),
    enabled: z.boolean().default(true),
    type: taskFields.type,
    description: taskFields.description,
    acceptanceCriteria: taskFields.acceptanceCriteria,
    pbi: taskFields.pbi,
    repos: taskFields.repos,
  }),
  async run(context, input) {
    const previous = input.id === null ? null : await readTaskSchedule(context.db, input.id);
    const vault = previous?.vault ?? input.vault;

    if (input.id !== null && !previous) {
      return { ok: false, error: `No schedule ${input.id} (schedule.list names them).` };
    }

    if (!vault) {
      return { ok: false, error: "A new schedule needs its vault." };
    }

    const saved = await context.powerloom.saveSchedule({ id: input.id, name: input.name, vault, cron: input.cron, enabled: input.enabled, taskType: input.type, description: input.description, acceptanceCriteria: input.acceptanceCriteria, pbi: input.pbi, repos: input.repos });

    return mapOutcome(saved, (schedule) => schedule);
  },
};
