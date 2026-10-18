import Link from "next/link";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { StatTile } from "@/components/StatTile";
import { formatEffortHours, formatPercent } from "@/lib/format";
import type { ChartSeries } from "@/models/ChartSeries";
import type { PbiEstimate } from "@/models/PbiEstimate";

const CHART_PBIS = 12;

// The finished PBIs' Original Estimate against the effort the user gave at finish (user request 2026-10-16): the totals
// over the PBIs that had an estimate, the latest ones as a chart, and the latest agent estimate (both values) in the table.
export function EstimateSection({ estimates }: { estimates: PbiEstimate[] }) {
  if (estimates.length === 0) {
    return <p className="muted">No finished PBIs yet: finishing a PBI asks for your effort.</p>;
  }

  const estimated = estimates.filter(hasOriginal);
  const originalTotal = estimated.reduce((sum, pbi) => sum + (pbi.originalHours ?? 0), 0);
  const actualTotal = estimated.reduce((sum, pbi) => sum + pbi.actualHours, 0);
  const shown = estimates.slice(0, CHART_PBIS).reverse();
  const labels = shown.map((pbi) => `PBI-${pbi.pbiId}`);
  const series: ChartSeries[] = [
    { key: "original", label: "Original estimate", color: "var(--series-1)", values: shown.map((pbi) => pbi.originalHours ?? 0) },
    { key: "actual", label: "Your effort", color: "var(--series-2)", values: shown.map((pbi) => pbi.actualHours) },
  ];

  return (
    <>
      <div className="stat-tiles">
        <StatTile label="Finished PBIs" value={String(estimates.length)} note={`${estimated.length} with an Original Estimate`} />
        <StatTile label="Estimated" value={formatEffortHours(originalTotal)} note="Original Estimate of those PBIs" />
        <StatTile label="Your effort" value={formatEffortHours(actualTotal)} note="given when finishing them" />
        <StatTile label="Effort / estimate" value={originalTotal > 0 ? formatPercent(actualTotal / originalTotal) : "–"} note="over 100% means it took longer" />
      </div>
      <div className="dashboard-charts">
        <GroupedColumns title="Estimate and effort, hours" labels={labels} series={series} format={formatEffortHours} />
        <EstimateTable estimates={estimates} />
      </div>
    </>
  );
}

function EstimateTable({ estimates }: { estimates: PbiEstimate[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>PBI</th>
            <th title="Your Tasks' Original Estimate in ADO, hours">Original</th>
            <th title="The latest agent estimate for a developer without an agent, hours">Human est.</th>
            <th title="The latest agent estimate for an agent implementing it, hours">Agent est.</th>
            <th title="Your effort, given when finishing the PBI, hours">Effort</th>
            <th title="Effort minus Original Estimate, hours">Off by</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((pbi) => (
            <tr key={pbi.pbiId}>
              <td><Link href={`/pbis/${pbi.pbiId}`} title={pbi.title}>PBI-{pbi.pbiId}</Link></td>
              <td>{formatOptional(pbi.originalHours)}</td>
              <td title={pbi.estimatedBy ?? undefined}>{formatOptional(pbi.humanHours)}</td>
              <td title={pbi.estimatedBy ?? undefined}>{formatOptional(pbi.agentHours)}</td>
              <td>{formatEffortHours(pbi.actualHours)}</td>
              <td>{hasOriginal(pbi) ? formatSigned(pbi.actualHours - (pbi.originalHours ?? 0)) : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// A zero Original Estimate is a placeholder, not an estimate: it would make any effort look infinitely off.
function hasOriginal(pbi: PbiEstimate): boolean {
  return pbi.originalHours !== null && pbi.originalHours > 0;
}

function formatOptional(hours: number | null): string {
  return hours === null ? "–" : formatEffortHours(hours);
}

function formatSigned(hours: number): string {
  return hours > 0 ? `+${formatEffortHours(hours)}` : formatEffortHours(hours);
}
