import Link from "next/link";
import { formatDuration, formatUsd } from "@/lib/format";
import type { PbiCost } from "@/models/PbiCost";

// The PBIs the agents spent the most on in the period, most expensive first.
export function CostliestPbis({ pbis }: { pbis: PbiCost[] }) {
  if (pbis.length === 0) {
    return <p className="muted">No agent runs on a PBI in this period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>PBI</th>
            <th>Title</th>
            <th>Runs</th>
            <th>Cost</th>
            <th title="The finished runs' run time, in all">Run time</th>
          </tr>
        </thead>
        <tbody>
          {pbis.map((pbi) => (
            <tr key={pbi.pbiId}>
              <td><Link href={`/pbis/${pbi.pbiId}`}>PBI-{pbi.pbiId}</Link></td>
              <td className="title">{pbi.title}</td>
              <td>{pbi.runs}</td>
              <td>{formatUsd(pbi.costUsd)}</td>
              <td>{formatDuration(pbi.durationMs)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
