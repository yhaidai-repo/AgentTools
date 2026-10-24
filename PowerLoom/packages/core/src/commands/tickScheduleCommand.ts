import { z } from "zod";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

// The schedule's "Create now": a regular task right away, unless one of the schedule's tasks still waits.
export const tickScheduleCommand: Command<{ id: number }, { result: string }> = {
  name: "schedule.tick",
  description: "Create a schedule's task now, as its next tick would (none while one of its tasks still waits; also for a schedule that is off). Answers what happened. Confirm with the user first, naming the schedule.",
  input: z.object({ id: z.number().int().positive().describe("The schedule (schedule.list)") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.tickSchedule(input.id), (result) => ({ result }));
  },
};
