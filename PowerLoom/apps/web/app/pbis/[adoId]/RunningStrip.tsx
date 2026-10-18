import Link from "next/link";
import type { PbiDetail } from "@/lib/pbiDetail";
import { RunTimer } from "./RunTimer";

type RunRow = PbiDetail["runs"][number];

// While an agent works on the PBI (user request 2026-10-18): a spinning ring, which agent on which task, a timer that
// counts up, and a soft light sweeping the strip; the run's live trace is one click away.
export function RunningStrip({ run, adoId }: { run: RunRow; adoId: number }) {
  return (
    <div className="running-strip">
      <span className="running-orbit" aria-hidden="true" />
      <span className="running-what">
        <b>{run.stage}</b> is working{run.itemId ? <> on <Link href={`/pbis/${adoId}/items/${run.itemId}`}>{run.itemId}</Link></> : null}
      </span>
      <RunTimer since={run.startedAt} />
      <Link href={`/agents/runs/${run.id}`}>Watch run ↗</Link>
    </div>
  );
}
