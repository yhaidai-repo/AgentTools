import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { Panel } from "@/components/Panel";
import type { FailureGroup } from "@/models/FailureGroup";

// The vault's latest distinct failures: the error on one line (all of it on hover), how many times it happened, and
// the latest run.
export function RecentFailures({ groups }: { groups: FailureGroup[] }) {
  if (groups.length === 0) {
    return <Panel><p className="empty">None in this period.</p></Panel>;
  }

  return (
    <Panel table>
      <table className="data-table">
        <thead>
          <tr>
            <th>Error</th>
            <th>Agent</th>
            <th className="num">Times</th>
            <th>Last run</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <tr key={`${group.agentId}-${group.latest.id}`}>
              <td className="clip text-faint" title={group.error}><span className="dot past-error inline" />{group.error}</td>
              <td>{group.agentId}</td>
              <td className="num">{group.times}</td>
              <td><Link href={`/agents/runs/${group.latest.id}`} className="id">RUN-{group.latest.id}</Link> <span className="text-faint"><LocalTime date={group.latest.startedAt} /></span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
