import { StackedColumns } from "@/components/charts/StackedColumns";
import { formatEffortHours } from "@/lib/format";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintSummary } from "@/models/SprintSummary";

const MAX_SPRINTS = 8;
const DONE_COLOR = "var(--series-6)";
const OPEN_COLOR = "var(--series-1)";

// How heavy each sprint was (user request 2026-10-16), oldest first: its items and its effort on the last snapshot day,
// done and not done. Same sprints and colors in both, so the two read side by side.
export function SprintComparison({ sprints }: { sprints: SprintSummary[] }) {
  const shown = sprints.slice(0, MAX_SPRINTS).reverse();
  const labels = shown.map((sprint) => sprint.iterationPath);
  const items = doneAndOpen(shown.map((sprint) => sprint.done), shown.map((sprint) => sprint.items - sprint.done));
  const effort = doneAndOpen(shown.map((sprint) => sprint.doneEffort ?? 0), shown.map((sprint) => (sprint.effort ?? 0) - (sprint.doneEffort ?? 0)));

  return (
    <div className="dashboard-charts">
      <StackedColumns title="Items per sprint" labels={labels} series={items} format={String} axisLabel={sprintName} />
      <StackedColumns title="Effort per sprint, hours" labels={labels} series={effort} format={formatEffortHours} axisLabel={sprintName} />
    </div>
  );
}

function doneAndOpen(done: number[], open: number[]): ChartSeries[] {
  return [
    { key: "done", label: "Done", color: DONE_COLOR, values: done },
    { key: "open", label: "Not done", color: OPEN_COLOR, values: open },
  ];
}

// The last segment of the iteration path: AA\2026\26.4.1 → 26.4.1.
function sprintName(iterationPath: string): string {
  return iterationPath.split("\\").at(-1) ?? iterationPath;
}
