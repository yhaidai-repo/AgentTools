import Link from "next/link";
import { Panel } from "@/components/Panel";
import { StatusRow } from "@/components/StatusRow";
import { TimeAgo } from "@/components/TimeAgo";
import { itemPath } from "@/lib/items";
import type { HeldTask } from "@/models/HeldTask";

const MAX_SHOWN = 6;

// The vault's open tasks the dispatcher didn't start, with their reasons (e.g. waiting for the user's answers): they wait
// on the user, so the panel breathes amber while any is held.
export function HeldTasks({ tasks }: { tasks: HeldTask[] }) {
  return (
    <Panel title="Held tasks" tone={tasks.length > 0 ? "warn" : "plain"}>
      {tasks.length === 0 && <p className="empty">None.</p>}
      {tasks.slice(0, MAX_SHOWN).map((task) => <HeldRow key={task.id} task={task} />)}
      {tasks.length > MAX_SHOWN && <p className="empty">and {tasks.length - MAX_SHOWN} more · <Link href="/tasks?status=open">Tasks page</Link></p>}
    </Panel>
  );
}

function HeldRow({ task }: { task: HeldTask }) {
  return <StatusRow name={<><Link href={itemPath(task)} className="id">{task.id}</Link> {task.kind}</>} value={<TimeAgo date={task.updatedAt} />} detail={[...new Set(task.heldBy)].join("; ")} tone="warn" />;
}
