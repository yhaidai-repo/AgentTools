import { ANY_AGENT, workerLabel, type TaskSchedule } from "@powerloom/core";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { StatusRow } from "@/components/StatusRow";
import { TimeAgo } from "@/components/TimeAgo";
import { cronText } from "@/lib/cronText";
import { ScheduleActions } from "./ScheduleActions";

// The task schedules (user decision 2026-10-03): each tick creates its agent's task only when one is needed. Below the
// task list (user decision 2026-10-18), the cron as people say it and the last tick as "2d ago".
export function ScheduleTable({ schedules }: { schedules: TaskSchedule[] }) {
  if (schedules.length === 0) {
    return <Panel><p className="empty">No scheduled tasks. New task with a schedule (cron) adds one.</p></Panel>;
  }

  return (
    <Panel>
      <div className="item-rows">
        {schedules.map((schedule) => (
          <div key={schedule.id} className="item-row schedule-row">
            <span className={schedule.enabled ? "dot ok" : "dot"} />
            <Link href={`/tasks/schedules/${schedule.id}`} className="schedule-name">{schedule.name}</Link>
            <span className="item-title" title={schedule.cron}>
              {schedule.taskType ? workerLabel(ANY_AGENT, schedule.taskType) : schedule.agentId} · {cronText(schedule.cron)}{schedule.enabled ? "" : " · off"}
              <span className="file-meta">{paramsText(schedule.params)}</span>
            </span>
            <span className="item-state">{schedule.lastRunAt ? <>last tick <TimeAgo date={schedule.lastRunAt} />{schedule.lastResult ? `: ${schedule.lastResult}` : ""}</> : "no tick yet"}</span>
            <ScheduleActions id={schedule.id} name={schedule.name} />
          </div>
        ))}
      </div>
    </Panel>
  );
}

// A goal schedule: the goal's first line and its repos; a schedule by task type: its description's first line and what it
// works on; a producer's: its params.
function paramsText(params: Record<string, unknown>): string {
  if (typeof params.description === "string") {
    const target = params.pbiId ? ` · PBI-${params.pbiId}` : "";
    const repos = Array.isArray(params.repos) && params.repos.length > 0 ? ` · repos: ${params.repos.join(", ")}` : "";

    return `${params.description.split(/\r?\n/)[0].slice(0, 80)}${target}${repos}`;
  }

  if (typeof params.goal === "string") {
    const repos = Array.isArray(params.repos) && params.repos.length > 0 ? ` · repos: ${params.repos.join(", ")}` : "";

    return `${params.goal.split(/\r?\n/)[0].slice(0, 80)}${repos}`;
  }

  return Object.entries(params).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ") || "–";
}
