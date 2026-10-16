import type { SprintSummary } from "@/models/SprintSummary";

// Every sprint with snapshots, newest first; the readable form of the sprint load charts.
export function SprintTable({ sprints }: { sprints: SprintSummary[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Sprint</th>
            <th>Days</th>
            <th>Items</th>
            <th>Done</th>
            <th title="Sum of your Tasks' Original Estimate, hours">Effort</th>
            <th title="Effort per item, hours">Effort / item</th>
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
              <td>{effortPerItem(sprint)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function effortPerItem(sprint: SprintSummary): string {
  if (sprint.effort === null || sprint.items === 0) {
    return "–";
  }

  return (sprint.effort / sprint.items).toFixed(1);
}
