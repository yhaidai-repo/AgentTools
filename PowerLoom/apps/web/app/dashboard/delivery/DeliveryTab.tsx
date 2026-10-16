import { loadPbiEstimates } from "@/lib/pbiEstimates";
import { loadTimeInStatus } from "@/lib/pipelineFlow";
import { loadSprintDays, loadSprintSummaries } from "@/lib/sprintProgress";
import { RangeFilter } from "../../agents/RangeFilter";
import { EstimateSection } from "./EstimateSection";
import { PipelineSection } from "./PipelineSection";
import { SprintComparison } from "./SprintComparison";
import { SprintSection } from "./SprintSection";

const MAX_ESTIMATES = 30;

// Sprint progress from the daily snapshots (the chosen sprint, how heavy the sprints were), the finished PBIs' estimates
// against the user's effort, and the pipeline's time in status from the status history.
export async function DeliveryTab({ sprint }: { sprint?: string }) {
  const sprints = await loadSprintSummaries();
  const chosen = sprints.find((summary) => summary.iterationPath === sprint) ?? sprints[0] ?? null;
  const [days, estimates, dwell] = await Promise.all([chosen ? loadSprintDays(chosen.iterationPath) : [], loadPbiEstimates(MAX_ESTIMATES), loadTimeInStatus()]);

  return (
    <>
      <h2>Sprint</h2>
      {chosen ? (
        <>
          <RangeFilter key={chosen.iterationPath} name="sprint" label="Sprint" range={chosen.iterationPath} ranges={sprints.map((summary) => ({ key: summary.iterationPath, label: summary.iterationPath }))} keep={{ tab: "delivery" }} />
          <SprintSection sprint={chosen} days={days} sprints={sprints} />
          <h2>Sprint load</h2>
          <SprintComparison sprints={sprints} />
        </>
      ) : (
        <p className="muted">No sprint snapshots yet: the PBI sync takes one per day once a vault has a current sprint.</p>
      )}
      <h2>Estimate vs effort</h2>
      <EstimateSection estimates={estimates} />
      <h2>Pipeline</h2>
      <PipelineSection dwell={dwell} />
    </>
  );
}
