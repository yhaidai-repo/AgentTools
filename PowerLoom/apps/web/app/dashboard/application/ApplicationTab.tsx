import { LocalTime } from "@/components/LocalTime";
import type { SystemStatus } from "@/lib/systemStatus";
import { ArchitectureScheme } from "./ArchitectureScheme";
import { AttentionList } from "./AttentionList";
import { nodeById } from "./schemeLayout";
import { schemeHealth } from "./schemeHealth";
import { StatePanels } from "./StatePanels";

// The architecture scheme colored by PowerLoom's status, what needs attention, and the state of each part. `focus` is
// the open level, `mark` the node to point at (both from the URL).
export function ApplicationTab({ status, focus, mark }: { status: SystemStatus | null; focus: string | null; mark: string | null }) {
  const health = schemeHealth(status);
  const level = focus && nodeById(focus) ? focus : null;

  return (
    <>
      {status ? <p className="muted">Checked <LocalTime date={new Date(status.checkedAt)} />.</p> : <p className="result-error">PowerLoom doesn&apos;t answer: the status below is unknown.</p>}
      <h2>Attention</h2>
      <AttentionList items={status?.attention ?? []} />
      <div className="dashboard-grid">
        <ArchitectureScheme health={health} focus={level} highlight={mark} />
        {status && <StatePanels status={status} />}
      </div>
    </>
  );
}
