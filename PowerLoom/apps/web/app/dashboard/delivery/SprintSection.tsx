import { StackedColumns } from "@/components/charts/StackedColumns";
import { Lines } from "@/components/charts/Lines";
import { StatTile } from "@/components/StatTile";
import { formatDayOfMonth } from "@/lib/format";
import { doneOn, isClosedState, itemsOn, sprintStates } from "@/lib/sprintProgress";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";

const SERIES_SLOTS = 8;

// The chosen sprint: its counters today, the items per ADO state over its days, and the remaining work when ADO
// carries it (a burndown needs the Remaining Work field filled in).
export function SprintSection({ sprint, days }: { sprint: SprintSummary; days: SprintDay[] }) {
  const today = days.at(-1);
  const states = sprintStates(days);
  const labels = days.map((day) => day.day);
  const remaining = days.map((day) => day.remainingWork);
  const hasRemaining = remaining.some((value) => value !== null && value > 0);

  return (
    <>
      <div className="stat-tiles">
        <StatTile label="Items" value={String(sprint.items)} note={`${sprint.days} snapshot day(s), ${sprint.firstDay} to ${sprint.lastDay}`} />
        <StatTile label="Done" value={String(sprint.done)} note={sprint.items > 0 ? `${Math.round((sprint.done / sprint.items) * 100)}% of the items` : undefined} />
        <StatTile label="In progress" value={today ? String(itemsOn(today) - doneOn(today) - (today.itemsByState.New ?? 0)) : "0"} note="every state but New, Ready for Release and Done" />
        <StatTile label="Effort" value={sprint.effort === null ? "–" : String(sprint.effort)} note={sprint.effort === null ? "no Original Estimate on your Tasks in ADO" : "sum of your Tasks' Original Estimate"} />
      </div>
      <div className="dashboard-charts">
        <StackedColumns title="Items per state, per day" labels={labels} series={stateSeries(days, states)} format={String} axisLabel={formatDayOfMonth} />
        {hasRemaining ? (
          <Lines title="Remaining work" labels={labels} values={remaining} format={String} axisLabel={formatDayOfMonth} />
        ) : (
          <figure className="chart chart-empty"><figcaption>Remaining work</figcaption><p className="muted">The sprint&apos;s items carry no Remaining Work in ADO: no burndown. The state chart shows the progress instead.</p></figure>
        )}
      </div>
    </>
  );
}

// A state keeps its color across sprints: its slot in the pipeline order of the states this sprint saw.
function stateSeries(days: SprintDay[], states: string[]): ChartSeries[] {
  return states.slice(0, SERIES_SLOTS).map((state, slot) => ({
    key: state,
    label: state,
    color: isClosedState(state) ? "var(--series-6)" : `var(--series-${slot + 1})`,
    values: days.map((day) => day.itemsByState[state] ?? 0),
  }));
}
