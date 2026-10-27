import Link from "next/link";
import { Panel } from "@/components/Panel";
import { formatDuration, formatUsd } from "@/lib/format";
import type { PbiCost } from "@/models/PbiCost";

// The vault's PBIs the agents spent the most on in the period, most expensive first; a title takes one line, the full
// one shows on hover.
export function CostliestPbis({ pbis }: { pbis: PbiCost[] }) {
  if (pbis.length === 0) {
    return <Panel><p className="empty">No agent runs on a PBI in this period.</p></Panel>;
  }

  return (
    <Panel table>
      <table className="data-table">
        <thead>
          <tr>
            <th>PBI</th>
            <th>Title</th>
            <th className="num">Runs</th>
            <th className="num">Cost</th>
            <th className="num" title="The finished runs' run time, in all">Run time</th>
          </tr>
        </thead>
        <tbody>
          {pbis.map((pbi) => (
            <tr key={pbi.pbiId}>
              <td><Link href={`/pbis/${pbi.pbiId}`} className="id">PBI-{pbi.pbiId}</Link></td>
              <td className="clip" title={pbi.title}>{pbi.title}</td>
              <td className="num">{pbi.runs}</td>
              <td className="num">{formatUsd(pbi.costUsd, pbi.accountingComplete)}</td>
              <td className="num">{formatDuration(pbi.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}
