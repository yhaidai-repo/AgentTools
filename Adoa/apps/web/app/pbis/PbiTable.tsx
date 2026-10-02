import { workItemUrl, type AdoSettings } from "@adoa/core";
import Link from "next/link";
import type { BacklogRow } from "@/models/BacklogRow";

// Checkboxes post `adoId` values with the surrounding PrepareForm.
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
            <tr key={row.adoId} className={row.outOfScope ? "out-of-scope" : undefined} title={row.outOfScope ? "Out of scope" : undefined}>
              <td>
                <input type="checkbox" name="adoId" value={row.adoId} aria-label={`Select ${row.adoId}`} />
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

function NeedsAction({ row }: { row: BacklogRow }) {
  if (row.openForYou === 0) {
    return null;
  }

  return <> · <Link href={`/pbis/${row.adoId}`} className="result-error">needs your action ({row.openForYou})</Link></>;
}
