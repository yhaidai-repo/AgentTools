import { Panel } from "@/components/Panel";
import { loadAiProviders } from "@/lib/aiProviders";
import { loadDeadLetters } from "@/lib/deadLetters";
import { loadApplicationPerformance } from "@/lib/applicationPerformance";
import { mcpAnswers } from "@/lib/mcpHealth";
import { loadObservabilityState, telemetryDashboardUrl } from "@/lib/observability";
import type { SystemStatus } from "@/lib/systemStatus";
import { ArchitectureScheme } from "./ArchitectureScheme";
import { DeadLetters } from "./DeadLetters";
import { HealthBand } from "./HealthBand";
import { TelemetryPanel } from "./TelemetryPanel";
import { PerformanceCharts } from "./PerformanceCharts";
import { nodeById } from "./schemeLayout";
import { schemeHealth } from "./schemeHealth";
import { StatePanels } from "./StatePanels";

interface ApplicationTabProps {
  status: SystemStatus | null;
  vault: string;
  focus: string | null;
  mark: string | null;
  range?: string;
}

// PowerLoom's own health (user decision 2026-10-13: service health, not delivery; 2026-10-18: only what belongs to the
// application, and the selected vault's integrations): health, state, dead letters, the telemetry viewer, and the
// architecture scheme last. `focus` is the scheme's open level, `mark` the node to point at (from the URL).
export async function ApplicationTab({ status, vault, focus, mark }: ApplicationTabProps) {
  const level = focus && nodeById(focus) ? focus : null;
  const [observability, performance] = await Promise.all([loadObservabilityState(), loadApplicationPerformance()]);
  const letters = status ? await loadDeadLetters() : null;

  return (
    <>
      {status ? <HealthBand status={status} /> : <Panel tone="error"><p className="text-error">PowerLoom doesn&apos;t answer: its status is unknown.</p></Panel>}
      {status && <div className="section-label">Status</div>}
      {status && <StatePanels status={status} vault={vault} observability={observability} />}
      <DeadLetters letters={letters} />
      <PerformanceCharts history={performance} />
      <TelemetryPanel state={observability} url={telemetryDashboardUrl()} />
      <div className="section-label">Architecture</div>
      <ArchitectureScheme health={schemeHealth(status, { providers: await loadAiProviders(), mcpAnswers: await mcpAnswers(), observability })} focus={level} highlight={mark} />
    </>
  );
}
