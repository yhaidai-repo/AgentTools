import type { pbiImport, PbiImportResult } from "@powerloom/db";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { ImportNowForm } from "./ImportNowForm";

type ImportRow = typeof pbiImport.$inferSelect;

const SOURCE_NAMES: Record<string, string> = { outlook: "Outlook", inbox: "Inbox", meetings: "Meetings" };

// The latest PBI imports of every source (Outlook, scripts, future jobs) and what each did with its PBIs; times as
// "2d ago", the exact one on hover.
export function ImportsPanel({ imports }: { imports: ImportRow[] }) {
  return (
    <>
      <div className="subsection-head">
        <h3>Imports</h3>
        <ImportNowForm />
      </div>
      {imports.length === 0 ? <Panel><p className="empty">Nothing imported yet.</p></Panel> : <ImportsTable imports={imports} />}
    </>
  );
}

function ImportsTable({ imports }: { imports: ImportRow[] }) {
  return (
    <Panel table>
      <table className="data-table imports-table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Source</th>
            <th>PBIs</th>
            <th className="num">Received</th>
            <th className="num">Imported</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((row) => (
            <tr key={row.id}>
              <td>{row.title ?? row.sourceRef}{row.sender && <span className="text-faint"> · {row.sender}</span>}</td>
              <td>{SOURCE_NAMES[row.source] ?? row.source}</td>
              <td><ImportResults results={row.results} /></td>
              <td className="num"><TimeAgo date={row.occurredAt} /></td>
              <td className="num"><TimeAgo date={row.updatedAt} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

function ImportResults({ results }: { results: PbiImportResult[] }) {
  if (results.length === 0) {
    return <span className="text-faint">no PBI links</span>;
  }

  return (
    <span className="import-results">
      {results.map((result) => (
        <span key={result.adoId} className={result.outcome === "failed" ? "import-chip failed" : "import-chip"} title={result.detail}>
          <Link href={`/pbis/${result.adoId}`}>PBI-{result.adoId}</Link> {result.outcome}
        </span>
      ))}
    </span>
  );
}
