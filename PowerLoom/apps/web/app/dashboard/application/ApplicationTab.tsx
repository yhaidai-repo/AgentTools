import { Panel } from "@/components/Panel";
import { loadAiProviders } from "@/lib/aiProviders";
import { mcpAnswers } from "@/lib/mcpHealth";
import { isObservabilityOn, observabilityState } from "@/lib/observability";
import { grafanaExploreUrl } from "@/lib/prometheus";
import type { SystemStatus } from "@/lib/systemStatus";
import { ArchitectureScheme } from "./ArchitectureScheme";
import { HealthBand } from "./HealthBand";
import { RatesSection, hasRates, loadRates } from "./RatesSection";
import { nodeById } from "./schemeLayout";
import { schemeHealth } from "./schemeHealth";
import { StatePanels } from "./StatePanels";

interface ApplicationTabProps {
  status: SystemStatus | null;
  vault: string;
  focus: string | null;
  mark: string | null;
}

// PowerLoom's own health (user decision 2026-10-13: service health, not delivery; 2026-10-18: only what belongs to the
// application, and the selected vault's integrations): the health band, the state of each part, the last 24 h of
// rates, and the architecture scheme last. `focus` is the scheme's open level, `mark` the node to point at (from the URL).
export async function ApplicationTab({ status, vault, focus, mark }: ApplicationTabProps) {
  const rates = await loadRates(new Date());
  const level = focus && nodeById(focus) ? focus : null;
  const observabilityOn = isObservabilityOn();

  return (
    <>
      {status ? <HealthBand status={status} rates={rates} /> : <Panel tone="error"><p className="text-error">PowerLoom doesn&apos;t answer: its status is unknown.</p></Panel>}
      {status && <div className="section-label">Status</div>}
      {status && <StatePanels status={status} vault={vault} observability={observabilityState(observabilityOn, hasRates(rates))} />}
      <div className="section-label">Last 24 h</div>
      <RatesSection rates={rates} grafana={grafanaExploreUrl()} observabilityOn={observabilityOn} />
      <div className="section-label">Architecture</div>
      <ArchitectureScheme health={schemeHealth(status, { providers: await loadAiProviders(), mcpAnswers: await mcpAnswers() })} focus={level} highlight={mark} />
    </>
  );
}
