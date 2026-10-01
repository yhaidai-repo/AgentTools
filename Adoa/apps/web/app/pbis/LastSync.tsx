import type { agentRun } from "@adoa/db";
import { LocalTime } from "@/components/LocalTime";

type RunRow = typeof agentRun.$inferSelect;

export function LastSync({ run }: { run: RunRow | undefined }) {
  if (!run) {
    return <span className="muted">No sync yet.</span>;
  }

  const detail = run.error ? ` – ${run.error}` : "";

  return (
    <span className={run.outcome === "failed" ? "result-error" : "muted"}>
      Last sync: {run.outcome}, <LocalTime date={run.endedAt ?? run.startedAt} />{detail}
    </span>
  );
}
