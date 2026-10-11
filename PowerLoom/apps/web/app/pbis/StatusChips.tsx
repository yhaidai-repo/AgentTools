import type { workItem } from "@powerloom/db";

type WorkItemRow = typeof workItem.$inferSelect;

export function StatusChips({ rows }: { rows: WorkItemRow[] }) {
  const counts = countBy(rows, (row) => row.pipelineStatus);

  return (
    <div className="chips">
      <span className="chip">shown: {rows.length}</span>
      {[...counts].map(([status, count]) => (
        <span className="chip" key={status}>{status}: {count}</span>
      ))}
    </div>
  );
}

function countBy(rows: WorkItemRow[], key: (row: WorkItemRow) => string): Map<string, number> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    counts.set(key(row), (counts.get(key(row)) ?? 0) + 1);
  }

  return counts;
}
