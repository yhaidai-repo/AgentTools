import { z } from "zod";
import type { Command } from "../models/Command";
import type { SystemStatus } from "../models/SystemStatus";

// The dashboard's Application tab: PowerLoom's own view of the running system, read over its API.
export const getStatusCommand: Command<Record<string, never>, SystemStatus> = {
  name: "status.get",
  effect: "read",
  description: "Read PowerLoom's status of the running system: the database, the schedule ticker, the agent-runner and the task it runs, the vaults' integrations and last syncs, the message queues and dead letters, the runs in progress (stuck ones marked), the schedules, the recent job runs, the daily budget, the outside systems the agents read, and what needs attention.",
  input: z.object({}),
  run(context) {
    return context.powerloom.status();
  },
};
