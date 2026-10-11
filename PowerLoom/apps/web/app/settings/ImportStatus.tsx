import type { ImportRunStatus, ImportSourceActivity, ImportSourceStatus } from "@powerloom/core";
import { LocalTime } from "@/components/LocalTime";

// Each source as the import job last saw it, and when it last imported something (a quiet source may be broken).
export function ImportStatus({ status, activity }: { status: ImportRunStatus | null; activity: ImportSourceActivity[] }) {
  if (!status) {
    return <p className="muted">Import: not run yet (Backlog → Import now, or wait for the import schedule).</p>;
  }

  if (!status.configured) {
    return <p className="result-error">Import: the import inbox (Import:InboxRoot) isn&apos;t set for PowerLoom.</p>;
  }

  return (
    <>
      <p className="muted">Import inbox <code>{process.env.IMPORT_INBOX_PATH ?? "IMPORT_INBOX_PATH"}</code>, last run <LocalTime date={status.checkedAt} />.</p>
      {status.sources.map((source) => <SourceLine key={source.source} source={source} activity={activity.find((entry) => entry.source === source.source)} />)}
    </>
  );
}

function SourceLine({ source, activity }: { source: ImportSourceStatus; activity: ImportSourceActivity | undefined }) {
  const lastImport = activity ? <>last import <LocalTime date={activity.lastImportAt} /></> : <>nothing imported yet</>;

  return (
    <p className={activity?.isQuiet ? "result-error" : "muted"}>
      {source.source}: {source.waiting} waiting, {source.failed} in failed/, {lastImport}{activity?.isQuiet && " (nothing for over a day: is the source still running?)"}
    </p>
  );
}
