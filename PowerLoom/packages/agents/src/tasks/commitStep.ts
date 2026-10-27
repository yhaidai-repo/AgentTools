import { createHash } from "node:crypto";
import { agentRun, type PowerLoomDb } from "@powerloom/db";
import { eq, sql } from "drizzle-orm";
import { addRunOutputs } from "./runOutputs";

function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => [key, canonical(item)]));
  return value;
}

// Output writes and their receipt share one transaction. A resumed run reuses only the identical persisted draft.
export async function commitStep<T>(db: PowerLoomDb, rootRunId: number, runId: number, kind: string, draft: unknown, action: (tx: PowerLoomDb) => Promise<T>): Promise<T> {
  const key = `${kind}:${createHash("sha256").update(JSON.stringify(canonical(draft)) ?? "null").digest("hex")}`;
  return db.transaction(async tx => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`${rootRunId}:${key}`}, 0))`);
    const found = await tx.execute(sql`select result from agent_commit_step where root_run_id=${rootRunId} and step_key=${key}`);
    const previous = found.rows[0]?.result as { value: T; outputs: string[] } | undefined;
    if (previous) { await addRunOutputs(tx, runId, previous.outputs); return previous.value; }
    const [before] = await tx.select({ outputs: agentRun.outputs }).from(agentRun).where(eq(agentRun.id, runId));
    const value = await action(tx as unknown as PowerLoomDb);
    const [after] = await tx.select({ outputs: agentRun.outputs }).from(agentRun).where(eq(agentRun.id, runId));
    const outputs = (after?.outputs ?? []).filter(output => !before?.outputs?.includes(output));
    const result = { value, outputs };
    await tx.execute(sql`insert into agent_commit_step(root_run_id, step_key, result) values (${rootRunId}, ${key}, ${JSON.stringify(result)}::jsonb)`);
    return value;
  });
}
