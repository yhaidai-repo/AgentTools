import { StackedColumns } from "@/components/charts/StackedColumns";
import { StatTile } from "@/components/StatTile";
import { formatDayOfMonth, formatEffortHours, formatPercent } from "@/lib/format";
import { doneOn, hasStateColor, itemsOn, OTHER_STATE_COLOR, sprintStates, stateColor } from "@/lib/sprintProgress";
import type { AgentEstimate } from "@/models/AgentEstimate";
import type { ChartSeries } from "@/models/ChartSeries";
import type { SprintDay } from "@/models/SprintDay";
import type { SprintSummary } from "@/models/SprintSummary";
import { SprintTable } from "./SprintTable";

interface SprintSectionProps {
  sprint: SprintSummary;
  days: SprintDay[];
  sprints: SprintSummary[];
  /** The agents' estimate of the sprint's PBIs: human and agent time. */
  agentEstimate: AgentEstimate;
}

// The chosen sprint: its counters today and the items per ADO state over its days, next to every sprint's table (which
// replaced the sprint load charts, user decision 2026-10-18). No burndown: the team leaves Remaining Work empty (user
// request 2026-10-16).
export function SprintSection({ sprint, days, sprints, agentEstimate }: SprintSectionProps) {
  const today = days.at(-1);
  const inProgress = today ? itemsOn(today) - doneOn(today) - (today.itemsByState.New ?? 0) : 0;
  const doneShare = sprint.items > 0 ? sprint.done / sprint.items : 0;

  return (
    <>
      <div className="band">
        <StatTile label="Items" value={String(sprint.items)} note={`${sprint.days} days of snapshots`} />
        <StatTile label="Done" value={String(sprint.done)} note={`${formatPercent(doneShare)} of the items`} tone="good">
          <span className="meter good"><span style={{ width: formatPercent(doneShare) }} /></span>
        </StatTile>
        <StatTile label="In progress" value={String(inProgress)} note="not New, Ready for release or Done" />
        <EstimateTile effort={sprint.effort} agentEstimate={agentEstimate} />
      </div>
      <div className="section-label">Sprint</div>
      <div className="grid wide-left">
        <StackedColumns title="Items per state, per day" labels={days.map((day) => day.day)} series={stateSeries(days, sprintStates(days))} format={String} axisLabel={formatDayOfMonth} />
        <SprintTable sprints={sprints} />
      </div>
    </>
  );
}

// Your estimate beside the agents', theirs split into human and agent time (user requests 2026-10-18).
function EstimateTile({ effort, agentEstimate }: { effort: number | null; agentEstimate: AgentEstimate }) {
  return (
    <div className="tile">
      <div className="tile-label">Estimate</div>
      <div className="tile-pair">
        <div>
          <div className="tile-value">{effort === null ? "–" : `${formatEffortHours(effort)} h`}</div>
          <div className="tile-note">yours: tasks&apos; Original Estimate</div>
        </div>
        <div>
          <div className="tile-value second">{hoursOf(agentEstimate.humanHours)}<small className="tile-value-unit">human</small></div>
          <div className="tile-note">agents: {hoursOf(agentEstimate.agentHours)} with an agent</div>
        </div>
      </div>
    </div>
  );
}

function hoursOf(hours: number | null): string {
  return hours === null ? "–" : `${formatEffortHours(hours)} h`;
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
