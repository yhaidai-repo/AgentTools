import { handoff, type PowerLoomDb } from "@powerloom/db";
import { asc, eq } from "drizzle-orm";
import type { RunHandoff } from "../models/RunHandoff";

/** The hand-offs a run made (its own tool's and its writers'), in the order it made them. */
export function handoffsOfRun(db: PowerLoomDb, runId: number): Promise<RunHandoff[]> {
  return db.select({ intent: handoff.intent, toItemId: handoff.toItemId }).from(handoff).where(eq(handoff.fromRunId, runId)).orderBy(asc(handoff.id));
}
