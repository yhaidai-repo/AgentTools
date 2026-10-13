import { LocalTime } from "@/components/LocalTime";
import { grafanaExploreUrl } from "@/lib/prometheus";
import type { SystemStatus } from "@/lib/systemStatus";
import { ArchitectureScheme } from "./ArchitectureScheme";
import { AttentionList } from "./AttentionList";
import { RatesSection, loadRates } from "./RatesSection";
import { nodeById } from "./schemeLayout";
import { schemeHealth } from "./schemeHealth";
import { StatePanels } from "./StatePanels";

// The architecture scheme colored by PowerLoom's status, what needs attention, the state of each part, and PowerLoom's
// rates from Prometheus (user decision 2026-10-13: service health, not delivery). `focus` is the open level, `mark` the
// node to point at (both from the URL).
export async function ApplicationTab({ status, focus, mark }: { status: SystemStatus | null; focus: string | null; mark: string | null }) {
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
      <h2>PowerLoom, last 24 h</h2>
      <RatesSection rates={await loadRates(new Date())} grafana={grafanaExploreUrl()} />
    </>
  );
}
