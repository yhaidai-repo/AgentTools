import { StackedColumns } from "@/components/charts/StackedColumns";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintSummary } from "@/models/SprintSummary";

const MAX_SPRINTS = 8;

// The sprints side by side, oldest first: done and open items on each one's last snapshot day, and the table.
export function SprintComparison({ sprints }: { sprints: SprintSummary[] }) {
  const shown = sprints.slice(0, MAX_SPRINTS).reverse();
  const series: ChartSeries[] = [
    { key: "done", label: "Done", color: "var(--series-6)", values: shown.map((sprint) => sprint.done) },
    { key: "open", label: "Not done", color: "var(--series-1)", values: shown.map((sprint) => sprint.items - sprint.done) },
  ];

  return (
    <div className="dashboard-charts">
      <StackedColumns title="Sprints side by side" labels={shown.map((sprint) => sprint.iterationPath)} series={series} format={String} axisLabel={sprintName} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Sprint</th>
              <th>Days</th>
              <th>Items</th>
              <th>Done</th>
              <th>Effort</th>
            </tr>
          </thead>
          <tbody>
            {sprints.map((sprint) => (
              <tr key={sprint.iterationPath}>
                <td>{sprint.iterationPath}</td>
                <td>{sprint.days}</td>
                <td>{sprint.items}</td>
                <td>{sprint.done}{sprint.items > 0 ? ` (${Math.round((sprint.done / sprint.items) * 100)}%)` : ""}</td>
                <td>{sprint.effort ?? "–"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// The last segment of the iteration path: AA\2026\26.4.1 → 26.4.1.
function sprintName(iterationPath: string): string {
  return iterationPath.split("\\").at(-1) ?? iterationPath;
}
