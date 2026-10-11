import Link from "next/link";

// Ways to create tasks from the Tasks page (user decision 2026-10-03); scheduled tasks first, one-off tasks can join later.
export function NewTaskMenu() {
  return (
    <details className="menu">
      <summary>New task ▾</summary>
      <ul>
        <li><Link href="/tasks/schedules/new">Scheduled task…</Link></li>
      </ul>
    </details>
  );
}
