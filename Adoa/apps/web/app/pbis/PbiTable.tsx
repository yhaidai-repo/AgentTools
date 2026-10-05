import { workItemUrl, type AdoSettings } from "@adoa/core";
import Link from "next/link";
import type { BacklogRow } from "@/models/BacklogRow";

// Checkboxes post `adoId` values with the surrounding BacklogForm.
export function PbiTable({ rows, ado }: { rows: BacklogRow[]; ado: AdoSettings | null }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th aria-label="Select" />
            <th>ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>Priority</th>
            <th>ADO state</th>
            <th>Pipeline</th>
            <th>Sprint</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.adoId}>
              <td>
                <input type="checkbox" name="adoId" value={row.adoId} data-title={row.title} aria-label={`Select ${row.adoId}`} />
              </td>
              <td>{ado ? <a href={workItemUrl(ado, row.adoId)} target="_blank" rel="noreferrer">{row.adoId}</a> : row.adoId}</td>
              <td className="title"><Link href={`/pbis/${row.adoId}`}>{row.title}</Link></td>
              <td>{row.type}</td>
              <td>{row.priority ?? "–"}</td>
              <td>{row.adoState}</td>
              <td>{row.pipelineStatus}<NeedsAction row={row} /></td>
              <td>{row.iterationPath}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Red only for what holds the agents back; findings to review are a quiet note (same split as the PBI page).
function NeedsAction({ row }: { row: BacklogRow }) {
  return (
    <>
      {row.openForYou > 0 && <> · <Link href={`/pbis/${row.adoId}`} className="result-error">needs your action ({row.openForYou})</Link></>}
      {row.findingsToReview > 0 && <> · <Link href={`/pbis/${row.adoId}`} className="muted">{row.findingsToReview} finding{row.findingsToReview === 1 ? "" : "s"} to review</Link></>}
    </>
  );
}
