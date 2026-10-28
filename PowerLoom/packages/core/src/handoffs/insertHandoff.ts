import { handoff, type PowerLoomDb } from "@powerloom/db";
import type { NewHandoff } from "../models/NewHandoff";

// Records a hand-off once its target item is written, in the same transaction.
export async function insertHandoff(db: PowerLoomDb, value: NewHandoff, toItemId: string): Promise<void> {
  await db.insert(handoff).values({
    fromTaskId: value.from.taskId,
    fromAgent: value.from.agent,
    fromRunId: value.from.runId,
    toKind: value.toKind,
    toItemId,
    intent: value.intent,
    gate: value.gate,
    body: value.package.body,
    refs: value.package.refs,
  });
}

