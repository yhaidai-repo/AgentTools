// The status pill of a step or an execution: `tone` colours it (lib/stepLooks: pending, skipped, open, running, done,
// blocked, cancelled; executions add failed), `label` is the word shown (the task status itself by default).
export function StatusBadge({ tone, label }: { tone: string; label?: string }) {
  return <span className={`badge ${tone}`}>{label ?? tone}</span>;
}
