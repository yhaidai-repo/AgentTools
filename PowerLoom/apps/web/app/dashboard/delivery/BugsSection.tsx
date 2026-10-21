import { StackedColumns } from "@/components/charts/StackedColumns";
import { Panel } from "@/components/Panel";
import { StatTile } from "@/components/StatTile";
import { formatPercent } from "@/lib/format";
import { sprintName } from "@/lib/sprintProgress";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintBugs } from "@/models/SprintBugs";

// Bugs are red (user, 2026-10-21): QA's in the error red, PowerLoom's in the lighter red of the app's bug tag.
const QA_COLOR = "var(--error)";
const POWERLOOM_COLOR = "#f9a8d4";

// Bugs per sprint (user request 2026-10-21): those QA files in Azure DevOps and those PowerLoom finds itself, so the
// share the agents catch first shows over the sprints. The tiles follow the sprint chosen above.
export function BugsSection({ bugs, chosen }: { bugs: SprintBugs[]; chosen: string | null }) {
  if (bugs.length === 0) {
    return <Panel><p className="empty">No bugs yet.</p></Panel>;
  }

  const current = bugs.find((sprint) => sprint.iterationPath === chosen) ?? null;

  return (
    <>
      <BugTiles sprint={current} />
      <StackedColumns title="Bugs per sprint" labels={bugs.map((sprint) => sprintName(sprint.iterationPath))} series={bugSeries(bugs)} format={String} />
    </>
  );
}

function BugTiles({ sprint }: { sprint: SprintBugs | null }) {
  const qa = sprint?.qa ?? 0;
  const powerloom = sprint?.powerloom ?? 0;
  const total = qa + powerloom;

  return (
    <div className="band">
      <StatTile label="Bugs" value={String(total)} note="this sprint" />
      <StatTile label="From QA" value={String(qa)} note="filed in Azure DevOps" />
      <StatTile label="Found by PowerLoom" value={String(powerloom)} note={reportersNote(sprint)} />
      <StatTile label="Found by PowerLoom first" value={total > 0 ? formatPercent(powerloom / total) : "–"} note="of the sprint's bugs" />
    </div>
  );
}

// Who reported PowerLoom's bugs, e.g. "autotest 2 · chat 1".
function reportersNote(sprint: SprintBugs | null): string {
  const reporters = Object.entries(sprint?.byReporter ?? {});

  return reporters.length > 0 ? reporters.map(([reporter, bugs]) => `${reporter} ${bugs}`).join(" · ") : "none this sprint";
}

function bugSeries(bugs: SprintBugs[]): ChartSeries[] {
  return [
    { key: "qa", label: "From QA", color: QA_COLOR, values: bugs.map((sprint) => sprint.qa) },
    { key: "powerloom", label: "Found by PowerLoom", color: POWERLOOM_COLOR, values: bugs.map((sprint) => sprint.powerloom) },
  ];
}
