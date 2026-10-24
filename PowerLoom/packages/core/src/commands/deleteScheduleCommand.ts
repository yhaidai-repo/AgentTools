import { z } from "zod";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

export const deleteScheduleCommand: Command<{ id: number }, { id: number }> = {
  name: "schedule.delete",
  effect: "destructive",
  description: "Delete a schedule: it creates no more tasks; the tasks it already made stay. Confirm with the user first, naming the schedule.",
  input: z.object({ id: z.number().int().positive().describe("The schedule (schedule.list)") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.deleteSchedule(input.id), () => ({ id: input.id }));
  },
};
