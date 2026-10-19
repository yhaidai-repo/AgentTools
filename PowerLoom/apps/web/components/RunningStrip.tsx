import Link from "next/link";
import { RunTimer } from "./RunTimer";

interface RunningRun {
  id: number;
  stage: string;
  itemId: string | null;
  startedAt: Date;
}

// While an agent works (user request 2026-10-18): a spinning ring, which agent on which task, a timer that counts up,
// and a soft light sweeping the strip; the run's live trace is one click away.
export function RunningStrip({ run, itemHref }: { run: RunningRun; itemHref: string | null }) {
  return (
    <div className="running-strip">
      <span className="running-orbit" aria-hidden="true" />
      <span className="running-what">
        <b>{run.stage}</b> is working{run.itemId && itemHref ? <> on <Link href={itemHref}>{run.itemId}</Link></> : null}
      </span>
      <RunTimer since={run.startedAt} />
      <Link href={`/agents/runs/${run.id}`}>Watch run ↗</Link>
    </div>
  );
}
