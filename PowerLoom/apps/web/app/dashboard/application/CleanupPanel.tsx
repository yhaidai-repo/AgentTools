import { Panel } from "@/components/Panel";
import { StatusRow } from "@/components/StatusRow";
import { TimeAgo } from "@/components/TimeAgo";
import { formatBytes } from "@/lib/format";
import type { SystemStatus } from "@/lib/systemStatus";
import type { Tone } from "@/models/Tone";

type CleanupStatus = SystemStatus["cleanups"][number];

// The selected vault's artefact cleanup: the last report per store (what went, or would go in a dry run), its errors.
export function CleanupPanel({ cleanup }: { cleanup: CleanupStatus | null }) {
  const report = cleanup?.lastReport ?? null;
  const tone: Tone = report && report.errors.length > 0 ? "warn" : "plain";

  return (
    <Panel title="Artefact cleanup" aside={<small>{cleanup?.dryRun ? "dry run" : "deleting"}</small>} tone={tone}>
      {!report && <StatusRow name="Last run" value="not yet" />}
      {report && <StatusRow name="Last run" value={<TimeAgo date={report.ranAt} />} detail={`${report.items ?? 0} item(s), ${formatBytes(report.bytes ?? 0)}${report.dryRun ? " would go" : " freed"}`} tone="good" />}
      {report?.stores.map((store) => (
        <StatusRow key={store.store} name={store.store} value={store.note ?? `${store.items} · ${formatBytes(store.bytes)}`} tone={store.note?.startsWith("failed") ? "error" : "plain"} />
      ))}
      {report?.errors.map((error) => <StatusRow key={error} name="Error" value={error} tone="error" />)}
    </Panel>
  );
}
