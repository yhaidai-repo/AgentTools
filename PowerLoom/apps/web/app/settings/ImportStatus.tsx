import type { ImportRunStatus, ImportSourceActivity, ImportSourceStatus } from "@powerloom/core";
import { TimeAgo } from "@/components/TimeAgo";

// Each source as the import job last saw it, and when it last imported something; a quiet source (it may be broken)
// gets an amber dot, never red text (user decision 2026-10-18).
export function ImportStatus({ status, activity }: { status: ImportRunStatus | null; activity: ImportSourceActivity[] }) {
  if (!status) {
    return <p className="hint">Not run yet (Backlog → Import now, or wait for the schedule).</p>;
  }

  if (!status.configured) {
    return <p className="text-warn">The mail import folder isn&apos;t configured for PowerLoom.</p>;
  }

  return (
    <div className="source-rows">
      <p className="hint">Last run <TimeAgo date={status.checkedAt} />.</p>
      {/* Older saved statuses may still contain the retired generic inbox source until the next import run. */}
      {status.sources.filter((source) => source.source !== "inbox").map((source) => <SourceRow key={source.source} source={source} activity={activity.find((entry) => entry.source === source.source)} />)}
    </div>
  );
}

function SourceRow({ source, activity }: { source: ImportSourceStatus; activity: ImportSourceActivity | undefined }) {
  return (
    <div className="source-row">
      <span className={activity?.isQuiet ? "dot warn" : "dot ok"} />
      <span>{source.source}</span>
      <span className="hint">{source.waiting} waiting · {source.failed} failed</span>
      <small className={activity?.isQuiet ? "text-warn" : undefined}>
        {activity ? <>last import <TimeAgo date={activity.lastImportAt} /></> : "nothing imported yet"}
        {activity?.isQuiet && ": nothing for over a day, is the source still running?"}
      </small>
    </div>
  );
}
