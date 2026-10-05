import { DISPATCH_QUEUE, PBI_QUEUE } from "../queues";
import type { CommandContext } from "../models/CommandContext";
import type { DispatchJob } from "../models/DispatchJob";
import type { PbiJob } from "../models/PbiJob";

// After a change: a dispatcher tick now (statuses, hand-ons) and, for a PBI, its notes re-rendered by the worker.
export async function notifyChange(context: CommandContext, adoId: number | null): Promise<void> {
  const tick: DispatchJob = {};

  await context.jobs.send(DISPATCH_QUEUE, tick);

  if (adoId === null) {
    return;
  }

  const refresh: PbiJob = { action: "refresh", adoId };

  await context.jobs.send(PBI_QUEUE, refresh);
}
