import type { TaskSchedule } from "@adoa/core";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { ScheduleActions } from "./ScheduleActions";

// The task schedules (user decision 2026-10-03): each tick creates its agent's task only when one is needed.
export function ScheduleTable({ schedules }: { schedules: TaskSchedule[] }) {
  if (schedules.length === 0) {
    return <p className="muted">No scheduled tasks. New task → Scheduled task… adds one.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Name</th><th>Agent</th><th>Cron</th><th>Params</th><th>Last tick</th><th></th></tr>
        </thead>
        <tbody>
          {schedules.map((schedule) => (
            <tr key={schedule.id}>
              <td><Link href={`/tasks/schedules/${schedule.id}`}>{schedule.name}</Link>{schedule.enabled ? "" : " (off)"}</td>
              <td>{schedule.agentId}</td>
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

function paramsText(params: Record<string, unknown>): string {
  return Object.entries(params).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value)}`).join(" · ") || "–";
}
