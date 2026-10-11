import { workItemUrl, type AdoSettings, type ChildItem } from "@powerloom/core";
import Link from "next/link";

const BUG_SOURCES: Record<string, string> = { ado: "QA (Azure DevOps)", internal: "reported in PowerLoom" };

// The PBI's child items (user decision 2026-10-09): QA's [BUG] Tasks, reported bugs and children created in PowerLoom, each
// with its own pipeline. New bugs are prepared on their own; report one with the bug.report command.
export function ChildItems({ items, ado }: { items: ChildItem[]; ado: AdoSettings | null }) {
  if (items.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>ID</th><th>Title</th><th>Type</th><th>Bug</th><th>ADO state</th><th>Pipeline</th><th /></tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr key={item.adoId}>
              <td><Link href={`/pbis/${item.adoId}`}>{item.adoId}</Link></td>
              <td className="title"><Link href={`/pbis/${item.adoId}`}>{item.title}</Link></td>
              <td>{item.type}</td>
              <td>{item.bugSource ? BUG_SOURCES[item.bugSource] : "–"}</td>
              <td>{item.adoState}</td>
              <td>{item.pipelineStatus}</td>
              <td><AdoLink item={item} ado={ado} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function AdoLink({ item, ado }: { item: ChildItem; ado: AdoSettings | null }) {
  const url = workItemUrl(ado, item);

  return url ? <a href={url} target="_blank" rel="noreferrer">open in ADO</a> : <span className="muted">local</span>;
}
