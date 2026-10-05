import type { TaskProducer } from "../models/TaskProducer";
import { vaultReviewProducer } from "./vaultReviewProducer";

// Every agent that can be scheduled; a new one registers its producer here.
export const TASK_PRODUCERS: TaskProducer[] = [vaultReviewProducer];

export function producerFor(agentId: string): TaskProducer | null {
  return TASK_PRODUCERS.find((producer) => producer.agentId === agentId) ?? null;
}
