import { Panel } from "@/components/Panel";
import { formatEffortHours, formatPercent } from "@/lib/format";
import { sprintName } from "@/lib/sprintProgress";
import type { SprintSummary } from "@/models/SprintSummary";

// Every sprint of the vault, newest first: how heavy each was (user request 2026-10-16), in place of the sprint load
// charts (user decision 2026-10-18).
export function SprintTable({ sprints }: { sprints: SprintSummary[] }) {
  return (
    <Panel title="Sprints" table>
      <table className="data-table">
        <thead>
          <tr>
            <th>Sprint</th>
            <th className="num">Items</th>
            <th className="num">Done</th>
            <th className="num" title="Sum of your Tasks' Original Estimate">Effort</th>
            <th className="num" title="Effort per item">Per item</th>
          </tr>
        </thead>
        <tbody>
          {sprints.map((sprint) => (
            <tr key={sprint.iterationPath}>
              <td title={sprint.iterationPath}>{sprintName(sprint.iterationPath)}</td>
              <td className="num">{sprint.items}</td>
              <td className="num">{sprint.done} <span className="text-faint">{sprint.items > 0 ? formatPercent(sprint.done / sprint.items) : ""}</span></td>
              <td className="num">{sprint.effort === null ? "–" : `${formatEffortHours(sprint.effort)} h`}</td>
              <td className="num">{effortPerItem(sprint)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function effortPerItem(sprint: SprintSummary): string {
  if (sprint.effort === null || sprint.items === 0) {
    return "–";
  }

  return `${(sprint.effort / sprint.items).toFixed(1)} h`;
}
