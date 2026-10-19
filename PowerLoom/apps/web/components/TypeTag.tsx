const BUG_SOURCES: Record<string, string> = { ado: "Bug · QA", internal: "Bug · reported" };

// What an item is, at a glance (user, 2026-10-18: tell bugs from tasks): PBI, Bug, a child Task marked as a bug (from QA
// or reported in PowerLoom), or a plain Task. Bugs are pink, not rose: a bug isn't a PowerLoom error.
export function TypeTag({ type, bugSource }: { type: string; bugSource: string | null }) {
  if (bugSource) {
    return <span className="type-tag bug">{BUG_SOURCES[bugSource] ?? "Bug"}</span>;
  }

  if (type === "Bug") {
    return <span className="type-tag bug">Bug</span>;
  }

  return type === "Task" ? <span className="type-tag task">Task</span> : <span className="type-tag pbi">PBI</span>;
}
