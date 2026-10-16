import { StackedColumns } from "@/components/charts/StackedColumns";
import { StatTile } from "@/components/StatTile";
import { formatDayOfMonth } from "@/lib/format";
import { doneOn, hasStateColor, itemsOn, OTHER_STATE_COLOR, sprintStates, stateColor } from "@/lib/sprintProgress";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";
import { SprintTable } from "./SprintTable";

interface SprintSectionProps {
  sprint: SprintSummary;
  days: SprintDay[];
  sprints: SprintSummary[];
}

// The chosen sprint: its counters today and the items per ADO state over its days, next to every sprint's table. No
// burndown: the team leaves Remaining Work empty (user request 2026-10-16: the empty panel is gone).
export function SprintSection({ sprint, days, sprints }: SprintSectionProps) {
  const today = days.at(-1);
  const states = sprintStates(days);
  const labels = days.map((day) => day.day);

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
        <SprintTable sprints={sprints} />
      </div>
    </>
  );
}

// A state keeps its color across sprints (stateColor); states ADO adds later fold into one "Other" series.
function stateSeries(days: SprintDay[], states: string[]): ChartSeries[] {
  const known = states.filter(hasStateColor).map((state) => ({ key: state, label: state, color: stateColor(state), values: days.map((day) => day.itemsByState[state] ?? 0) }));
  const others = states.filter((state) => !hasStateColor(state));

  if (others.length === 0) {
    return known;
  }

  return [...known, { key: "other", label: "Other", color: OTHER_STATE_COLOR, values: days.map((day) => others.reduce((sum, state) => sum + (day.itemsByState[state] ?? 0), 0)) }];
}
