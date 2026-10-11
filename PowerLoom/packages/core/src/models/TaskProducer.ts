import type { itemKind } from "@powerloom/db";
import type { GlobalItemPrefix } from "../localItemIds";
import type { ProducerParamSpec } from "./ProducerParamSpec";

// How scheduled tasks for one agent look (user decision 2026-10-03): the form's choices. PowerLoom holds the producer
// itself (the "needed?" check and the task's data). Only agents with a producer can be scheduled without a goal.
export interface TaskProducer {
  agentId: string;
  kind: (typeof itemKind.enumValues)[number];
  prefix: GlobalItemPrefix;
  description: string;
  /** Scheduled from the vault's Maintenance tab only (user decision 2026-10-06), not from the generic scheduled-task form. */
  maintenance: boolean;
  params: ProducerParamSpec[];
}
