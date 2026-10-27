import type { AgentRunJob } from "@powerloom/core";
import type { CompletedRun } from "./powerloomCallback";

interface Lifecycle {
  maintain: () => Promise<void>;
  execute: () => Promise<CompletedRun | null>;
  cleanups: ((completed: CompletedRun) => Promise<void>)[];
  report: (completed: CompletedRun) => Promise<void>;
}

// Maintenance and disposal failures never hide the actual run result or skip another disposal/callback.
export async function runAcceptedJob(job: AgentRunJob, lifecycle: Lifecycle): Promise<void> {
  const attempt = async (name: string, action: () => Promise<void>) => {
    try { await action(); }
    catch (error) { console.error(`${job.taskId}: ${name} failed:`, error); }
  };
  let completed: CompletedRun = { runId: null, outcome: "aborted", error: "the task was not started (its held reasons say why)" };
  try {
    await attempt("retention", lifecycle.maintain);
    completed = await lifecycle.execute() ?? completed;
  } catch (error) {
    console.error(`${job.agentId} ${job.taskId} failed:`, error);
    completed = { runId: null, outcome: "failed", error: String(error) };
  } finally {
    for (const cleanup of lifecycle.cleanups) await attempt("cleanup", () => cleanup(completed));
    await attempt("completion report", () => lifecycle.report(completed));
  }
}
