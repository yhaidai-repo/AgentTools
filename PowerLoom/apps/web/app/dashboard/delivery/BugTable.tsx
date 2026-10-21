import { Panel } from "@/components/Panel";
import { formatPercent } from "@/lib/format";
import { sprintName } from "@/lib/sprintProgress";
import type { SprintBugs } from "@/models/SprintBugs";

// Every sprint's bugs, newest first, beside the chart as the sprint table is beside its chart.
export function BugTable({ bugs }: { bugs: SprintBugs[] }) {
  return (
    <Panel title="Bugs by sprint" table>
      <table className="data-table">
        <thead>
          <tr>
            <th>Sprint</th>
            <th className="num">QA</th>
            <th className="num">PowerLoom</th>
            <th className="num">All</th>
          </tr>
        </thead>
        <tbody>
          {[...bugs].reverse().map((sprint) => <BugRow key={sprint.iterationPath} sprint={sprint} />)}
        </tbody>
      </table>
    </Panel>
  );
}

function BugRow({ sprint }: { sprint: SprintBugs }) {
  const total = sprint.qa + sprint.powerloom;

  return (
    <tr>
      <td title={sprint.iterationPath}>{sprintName(sprint.iterationPath)}</td>
      <td className="num">{sprint.qa}</td>
      <td className="num">{sprint.powerloom} <span className="text-faint">{total > 0 ? formatPercent(sprint.powerloom / total) : ""}</span></td>
      <td className="num">{total}</td>
    </tr>
  );
}
