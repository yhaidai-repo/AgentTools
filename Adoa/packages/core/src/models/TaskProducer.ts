import type { itemKind } from "@adoa/db";
import type { GlobalItemPrefix } from "../localItemIds";
import type { Outcome } from "./Outcome";
import type { ProducedTask } from "./ProducedTask";
import type { ProducerContext } from "./ProducerContext";
import type { ProducerParamSpec } from "./ProducerParamSpec";

// How scheduled tasks for one agent are made (user decision 2026-10-03): its params, and the check whether a task is
// needed now. Only agents with a producer can be scheduled, since each executor expects its own task data.
export interface TaskProducer {
  agentId: string;
  kind: (typeof itemKind.enumValues)[number];
  prefix: GlobalItemPrefix;
  description: string;
  params: ProducerParamSpec[];
  /** The task for this tick, saying whether it is needed; an error when none can be made (e.g. no vault left). */
  produce(context: ProducerContext, params: Record<string, unknown>): Promise<Outcome<ProducedTask>>;
}
