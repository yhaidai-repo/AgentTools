import { loadTimeInStatus, loadWeeklyThroughput } from "@/lib/pipelineFlow";
import { grafanaExploreUrl } from "@/lib/prometheus";
import { loadSprintDays, loadSprintSummaries } from "@/lib/sprintProgress";
import { RangeFilter } from "../../agents/RangeFilter";
import { PipelineSection } from "./PipelineSection";
import { RatesSection, loadRates } from "./RatesSection";
import { SprintComparison } from "./SprintComparison";
import { SprintSection } from "./SprintSection";

const THROUGHPUT_STATUSES = ["ready-for-dev", "done"];
const THROUGHPUT_WEEKS = 8;

// Sprint progress from the daily snapshots (the chosen sprint, the sprints side by side), the pipeline's throughput
// and time in status from the status history, and PowerLoom's rates from Prometheus.
export async function DeliveryTab({ sprint }: { sprint?: string }) {
  const now = new Date();
  const sprints = await loadSprintSummaries();
  const chosen = sprints.find((summary) => summary.iterationPath === sprint) ?? sprints[0] ?? null;
  const [days, throughput, dwell, rates] = await Promise.all([chosen ? loadSprintDays(chosen.iterationPath) : [], loadWeeklyThroughput(THROUGHPUT_STATUSES, THROUGHPUT_WEEKS, now), loadTimeInStatus(), loadRates(now)]);

  return (
    <>
      <h2>Sprint</h2>
      {chosen ? (
        <>
          <RangeFilter key={chosen.iterationPath} name="sprint" label="Sprint" range={chosen.iterationPath} ranges={sprints.map((summary) => ({ key: summary.iterationPath, label: summary.iterationPath }))} keep={{ tab: "delivery" }} />
          <SprintSection sprint={chosen} days={days} />
          <SprintComparison sprints={sprints} />
        </>
      ) : (
        <p className="muted">No sprint snapshots yet: the PBI sync takes one per day once a vault has a current sprint.</p>
      )}
      <h2>Pipeline</h2>
      <PipelineSection throughput={throughput} statuses={THROUGHPUT_STATUSES} dwell={dwell} />
      <h2>PowerLoom, last 24 h</h2>
      <RatesSection rates={rates} grafana={grafanaExploreUrl()} />
    </>
  );
}
