import type { pbiImport, PbiImportResult } from "@powerloom/db";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { ImportNowForm } from "./ImportNowForm";

type ImportRow = typeof pbiImport.$inferSelect;

// The latest PBI imports of every source (Outlook, scripts, future jobs) and what each did with its PBIs.
export function ImportsPanel({ imports }: { imports: ImportRow[] }) {
  return (
    <>
      <div className="toolbar section-head">
        <h2>Imports</h2>
        <ImportNowForm />
      </div>
      {imports.length === 0 ? <p className="muted">Nothing imported yet.</p> : <ImportsTable imports={imports} />}
    </>
  );
}

function ImportsTable({ imports }: { imports: ImportRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Imported</th>
            <th>Received</th>
            <th>Source</th>
            <th>Item</th>
            <th>PBIs</th>
          </tr>
        </thead>
        <tbody>
          {imports.map((row) => (
            <tr key={row.id}>
              <td><LocalTime date={row.updatedAt} /></td>
              <td><LocalTime date={row.occurredAt} /></td>
              <td>{row.source}</td>
              <td>{row.title ?? row.sourceRef}{row.sender && <span className="muted"> · {row.sender}</span>}</td>
              <td><ImportResults results={row.results} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ImportResults({ results }: { results: PbiImportResult[] }) {
  if (results.length === 0) {
    return <span className="muted">no PBI links</span>;
  }

  return (
    <span className="chips">
      {results.map((result) => (
        <span key={result.adoId} className={result.outcome === "failed" ? "chip result-error" : "chip"} title={result.detail}>
          <Link href={`/pbis/${result.adoId}`}>PBI-{result.adoId}</Link> {result.outcome}
        </span>
      ))}
    </span>
  );
}
