import Link from "next/link";
import { Dropdown } from "@/components/Dropdown";
import { formatDaySpan, formatPercent } from "@/lib/format";
import { sprintName } from "@/lib/sprintProgress";
import type { SprintSummary } from "@/models/SprintSummary";

// The sprint the tab shows, picked from the shared dropdown (user, 2026-10-18: no unstyled system list); each entry
// tells its days, items and how much is done. The choice lives in the URL.
export function SprintPicker({ sprints, chosen }: { sprints: SprintSummary[]; chosen: SprintSummary }) {
  return (
    <div className="picker">
      Sprint
      <Dropdown label="Sprint" pill trigger={<><span>{sprintName(chosen.iterationPath)}</span><span className="text-faint">{formatDaySpan(chosen.firstDay, chosen.lastDay)}</span></>}>
        <div className="menu-title">Sprints</div>
        {sprints.map((sprint) => <SprintChoice key={sprint.iterationPath} sprint={sprint} current={sprint.iterationPath === chosen.iterationPath} />)}
      </Dropdown>
    </div>
  );
}

function SprintChoice({ sprint, current }: { sprint: SprintSummary; current: boolean }) {
  const done = sprint.items > 0 ? formatPercent(sprint.done / sprint.items) : "0%";

  return (
    <Link href={`/dashboard?tab=delivery&sprint=${encodeURIComponent(sprint.iterationPath)}`} className={`menu-item${current ? " current" : ""}`} role="menuitem">
      <span className="menu-text">
        {sprintName(sprint.iterationPath)}
        <small>{formatDaySpan(sprint.firstDay, sprint.lastDay)} · {sprint.items} items · {done} done</small>
      </span>
      {current && <span className="menu-check" aria-label="current">✓</span>}
    </Link>
  );
}
