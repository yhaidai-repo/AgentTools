// The status pill of a node or an execution: idle, waiting, running, done (or cancelled).
export function StatusBadge({ status }: { status: string }) {
  return <span className={`badge ${status}`}>{status}</span>;
}
