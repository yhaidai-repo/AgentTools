import type { agentRun } from "@adoa/db";

type RunRow = typeof agentRun.$inferSelect;

export function LastSync({ run }: { run: RunRow | undefined }) {
  if (!run) {
    return <span className="muted">No sync yet.</span>;
  }

  const when = (run.endedAt ?? run.startedAt).toLocaleString();
  const detail = run.error ? ` – ${run.error}` : "";

  return (
    <span className={run.outcome === "failed" ? "result-error" : "muted"}>
      Last sync: {run.outcome}, {when}{detail}
    </span>
  );
}
