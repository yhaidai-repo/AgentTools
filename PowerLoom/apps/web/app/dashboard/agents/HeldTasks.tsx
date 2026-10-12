import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import { itemPath } from "@/lib/items";
import type { HeldTask } from "@/models/HeldTask";

const MAX_SHOWN = 8;

// Open tasks the dispatcher didn't start, with their reasons (e.g. waiting for the user's answers).
export function HeldTasks({ tasks }: { tasks: HeldTask[] }) {
  if (tasks.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <>
      {tasks.slice(0, MAX_SHOWN).map((task) => (
        <p key={task.id} className="dashboard-row">
          <span className="state-dot state-degraded" />
          <strong><Link href={itemPath(task)}>{task.id}</Link></strong> <span className="muted">{task.kind} · {task.vault} · <TimeAgo date={task.updatedAt} /></span>
          <br />
          <span className="muted held-reasons">{[...new Set(task.heldBy)].join("; ")}</span>
        </p>
      ))}
      {tasks.length > MAX_SHOWN && <p className="muted">and {tasks.length - MAX_SHOWN} more · <Link href="/tasks?status=open">Tasks page</Link></p>}
    </>
  );
}
