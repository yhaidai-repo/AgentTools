import { workItemUrl, type AdoSettings, type ChildItem } from "@powerloom/core";
import Link from "next/link";
import { AdoTag } from "@/components/AdoTag";
import { PipelinePill } from "@/components/PipelinePill";
import { TypeTag } from "@/components/TypeTag";

// A PBI's child items (user decision 2026-10-09): QA's [BUG] Tasks from Azure DevOps on its Azure DevOps tab, reported
// bugs and children created in PowerLoom on its Agents tab (as ChildItemRows), each with its own pipeline, in the
// Backlog's row style. New bugs are prepared on their own; report one with the
// bug.report command.
export function ChildItems({ items, ado }: { items: ChildItem[]; ado: AdoSettings | null }) {
  if (items.length === 0) {
    return <p className="empty">None.</p>;
  }

  return (
    <table className="data-table child-table">
      <tbody>
        {items.map((item) => (
          <tr key={item.adoId}>
            <td className="col-id"><span className="id">{item.adoId}</span><AdoTag url={workItemUrl(ado, item)} /></td>
            <td className="title">
              <Link href={`/pbis/${item.adoId}`} className="row-title">{item.title}</Link>
              <div className="row-facts"><TypeTag type={item.type} bugSource={item.bugSource} />{item.adoState && <span>{item.adoState}</span>}</div>
            </td>
            <td className="col-stage"><PipelinePill status={item.pipelineStatus} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
