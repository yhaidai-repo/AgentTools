import Link from "next/link";
import { GroupedColumns } from "@/components/charts/GroupedColumns";
import { Panel } from "@/components/Panel";
import { StatTile } from "@/components/StatTile";
import { formatEffortHours, formatPercent } from "@/lib/format";
import type { ChartSeries } from "@/models/ChartSeries";
import type { PbiEstimate } from "@/models/PbiEstimate";

const CHART_PBIS = 12;

// The finished PBIs' Original Estimate and the agents' estimate against the effort the user gave at finish (user
// requests 2026-10-16 and 2026-10-18): the totals over the PBIs that had an estimate, the latest ones as a chart (the
// agents' estimate for a developer only, user request 2026-10-18), and the estimates per PBI in the table.
export function EstimateSection({ estimates }: { estimates: PbiEstimate[] }) {
  if (estimates.length === 0) {
    return <Panel><p className="empty">No finished PBIs yet: finishing a PBI asks for your effort.</p></Panel>;
  }

  const estimated = estimates.filter(hasOriginal);
  const originalTotal = estimated.reduce((sum, pbi) => sum + (pbi.originalHours ?? 0), 0);
  const actualTotal = estimated.reduce((sum, pbi) => sum + pbi.actualHours, 0);
  const ratio = originalTotal > 0 ? actualTotal / originalTotal : null;
  const shown = estimates.slice(0, CHART_PBIS).reverse();
  const series: ChartSeries[] = [
    { key: "original", label: "Original", color: "var(--accent)", values: shown.map((pbi) => pbi.originalHours ?? 0) },
    { key: "human", label: "Agents", color: "var(--accent-2)", values: shown.map((pbi) => humanHours(pbi) ?? 0) },
    { key: "actual", label: "Your effort", color: "var(--text)", values: shown.map((pbi) => pbi.actualHours) },
  ];

  return (
    <>
      <div className="band">
        <StatTile label="Finished PBIs" value={String(estimates.length)} note={`${estimated.length} with an Original Estimate`} />
        <StatTile label="Estimated" value={`${formatEffortHours(originalTotal)} h`} note={`for those ${estimated.length} PBIs`} />
        <StatTile label="Your effort" value={`${formatEffortHours(actualTotal)} h`} note="given when finishing them" />
        <StatTile label="Effort / estimate" value={ratio === null ? "–" : formatPercent(ratio)} note="under 100% is faster than estimated" tone={ratio !== null && ratio <= 1 ? "good" : "plain"} />
      </div>
      <div className="grid two gap-top">
        <GroupedColumns title="Estimates and effort, hours" labels={shown.map((pbi) => `PBI-${pbi.pbiId}`)} series={series} format={formatEffortHours} axisLabel={(label) => label.replace("PBI-", "")} />
        <EstimateTable estimates={estimates} />
      </div>
    </>
  );
}

function EstimateTable({ estimates }: { estimates: PbiEstimate[] }) {
  return (
    <Panel table>
      <table className="data-table">
        <thead>
          <tr>
            <th>PBI</th>
            <th className="num" title="Your Tasks' Original Estimate in ADO">Original</th>
            <th className="num" title="The agents' estimate for a developer: the design's, else the refinement's">Human</th>
            <th className="num" title="The design agent's estimate with an agent doing the work">Agent</th>
            <th className="num" title="Your effort, given when finishing the PBI">Effort</th>
          </tr>
        </thead>
        <tbody>
          {estimates.map((pbi) => (
            <tr key={pbi.pbiId}>
              <td><Link href={`/pbis/${pbi.pbiId}`} className="id" title={pbi.title}>PBI-{pbi.pbiId}</Link></td>
              <td className="num">{formatOptional(pbi.originalHours)}</td>
              <td className="num">{formatOptional(humanHours(pbi))}</td>
              <td className="num">{formatOptional(pbi.designAgentHours)}</td>
              <td className="num">{formatOptional(pbi.actualHours)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

// The agents' human estimate: the design agent's, else the refinement agent's (design is later and finer).
function humanHours(pbi: PbiEstimate): number | null {
  return pbi.designHours ?? pbi.refinementHours;
}

// A zero Original Estimate is a placeholder, not an estimate: it would make any effort look infinitely off.
function hasOriginal(pbi: PbiEstimate): boolean {
  return pbi.originalHours !== null && pbi.originalHours > 0;
}

function formatOptional(hours: number | null): string {
  return hours === null ? "–" : `${formatEffortHours(hours)} h`;
}
