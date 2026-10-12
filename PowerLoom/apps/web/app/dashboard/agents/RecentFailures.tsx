import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import type { FailedRun } from "@/models/FailedRun";

export function RecentFailures({ runs }: { runs: FailedRun[] }) {
  if (runs.length === 0) {
    return <p className="muted">None in this period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Run</th>
            <th>Agent</th>
            <th>Task</th>
            <th>Started</th>
            <th>Outcome</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <tr key={run.id}>
              <td><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link></td>
              <td>{run.agentId}</td>
              <td>{run.itemId ?? (run.pbiId ? <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link> : "–")}</td>
              <td><LocalTime date={run.startedAt} /></td>
              <td className="result-error">{run.outcome}</td>
              <td className="title result-error">{run.error}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
