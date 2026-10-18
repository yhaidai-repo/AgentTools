import Link from "next/link";
import { stageLabel } from "@/lib/pipelineStages";
import { backlogUrl } from "@/lib/backlogUrl";
import type { BacklogRow } from "@/models/BacklogRow";
import type { BacklogView } from "@/models/BacklogView";

// The status filter and the counts in one row of pills (user decision 2026-10-18): a pill toggles its status, several
// at once (user request 2026-10-13); All clears the choice. Counts are over the whole vault, not the page.
export function StatusPills({ rows, statuses, view }: { rows: BacklogRow[]; statuses: string[]; view: BacklogView }) {
  const counts = countByStatus(rows);
  const shown = statuses.filter((status) => counts.has(status));

  return (
    <nav className="status-pills" aria-label="Filter by status">
      <Link href={backlogUrl({ size: view.size })} className={view.statuses.length === 0 ? "status-pill on" : "status-pill"}>All <b>{rows.length}</b></Link>
      {shown.map((status) => (
        <Link key={status} href={backlogUrl({ statuses: toggled(view.statuses, status, statuses), size: view.size })} className={view.statuses.includes(status) ? "status-pill on" : "status-pill"}>
          {stageLabel(status)} <b>{counts.get(status)}</b>
        </Link>
      ))}
    </nav>
  );
}

// The choice with the status added or removed, kept in pipeline order.
function toggled(selected: string[], status: string, statuses: string[]): string[] {
  return selected.includes(status) ? selected.filter((value) => value !== status) : statuses.filter((value) => value === status || selected.includes(value));
}

function countByStatus(rows: BacklogRow[]): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(row.pipelineStatus, (counts.get(row.pipelineStatus) ?? 0) + 1);
  }

  return counts;
}
