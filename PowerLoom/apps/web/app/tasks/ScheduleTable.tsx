import { ANY_AGENT, workerLabel, type TaskSchedule } from "@powerloom/core";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { ScheduleActions } from "./ScheduleActions";

// The task schedules (user decision 2026-10-03): each tick creates its task unless the last one still waits.
export function ScheduleTable({ schedules }: { schedules: TaskSchedule[] }) {
  if (schedules.length === 0) {
    return <p className="muted">No scheduled tasks. New task with a schedule (cron) adds one.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Agent</th><th>Cron</th><th>Task</th><th>Last tick</th><th></th></tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => (
            <tr key={schedule.id}>
              <td><Link href={`/tasks/schedules/${schedule.id}`}>{schedule.name}</Link>{schedule.enabled ? "" : " (off)"}</td>
              <td>{schedule.taskType ? workerLabel(ANY_AGENT, schedule.taskType) : schedule.agentId}</td>
              <td><code>{schedule.cron}</code></td>
              <td>{paramsText(schedule.params)}</td>
              <td className="title">{schedule.lastRunAt ? <><LocalTime date={schedule.lastRunAt} />: {schedule.lastResult}</> : "–"}</td>
              <td><ScheduleActions id={schedule.id} name={schedule.name} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The task's description (first line) and what it works on.
function paramsText(params: Record<string, unknown>): string {
  const description = typeof params.description === "string" ? params.description.split(/\r?\n/)[0].slice(0, 80) : "–";
  const target = params.pbiId ? ` · PBI-${params.pbiId}` : "";
  const repos = Array.isArray(params.repos) && params.repos.length > 0 ? ` · repos: ${params.repos.join(", ")}` : "";

  return `${description}${target}${repos}`;
}
