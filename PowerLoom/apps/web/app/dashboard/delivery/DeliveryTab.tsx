import { Panel } from "@/components/Panel";
import { loadPbiEstimates } from "@/lib/pbiEstimates";
import { loadTimeInStatus } from "@/lib/pipelineFlow";
import { loadSprintAgentEstimate } from "@/lib/sprintAgentEstimate";
import { loadSprintDays, loadSprintSummaries } from "@/lib/sprintProgress";
import { EstimateSection } from "./EstimateSection";
import { PipelineSection } from "./PipelineSection";
import { SprintPicker } from "./SprintPicker";
import { SprintSection } from "./SprintSection";

const MAX_ESTIMATES = 30;

// The vault's delivery (user decision 2026-10-18: the dashboard shows the selected vault): the chosen sprint from the
// daily snapshots, the finished PBIs' estimates against the user's effort, and the pipeline's time in status.
export async function DeliveryTab({ vault, sprint }: { vault: string; sprint?: string }) {
  const sprints = await loadSprintSummaries(vault);
  const chosen = sprints.find((summary) => summary.iterationPath === sprint) ?? sprints[0] ?? null;
  const [days, agentEstimate, estimates, dwell] = await Promise.all([
    chosen ? loadSprintDays(chosen.iterationPath, vault) : [],
    chosen ? loadSprintAgentEstimate(chosen.iterationPath, chosen.lastDay, vault) : { humanHours: null, agentHours: null },
    loadPbiEstimates(MAX_ESTIMATES, vault),
    loadTimeInStatus(vault),
  ]);

  return (
    <>
      {chosen && <SprintPicker sprints={sprints} chosen={chosen} />}
      {chosen ? <SprintSection sprint={chosen} days={days} sprints={sprints} agentEstimate={agentEstimate} /> : <Panel><p className="empty">No sprint snapshots yet: the PBI sync takes one per day once the vault has a current sprint.</p></Panel>}
      <div className="section-label">Estimate vs effort</div>
      <EstimateSection estimates={estimates} />
      <div className="section-label">Pipeline: time in each status</div>
      <PipelineSection dwell={dwell} />
    </>
  );
}
