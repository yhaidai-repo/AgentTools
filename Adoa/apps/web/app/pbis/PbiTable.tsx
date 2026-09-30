import type { workItem } from "@adoa/db";

type WorkItemRow = typeof workItem.$inferSelect;

export function PbiTable({ rows, itemUrlBase }: { rows: WorkItemRow[]; itemUrlBase: string | null }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Type</th>
            <th>ADO state</th>
            <th>Pipeline</th>
            <th>Sprint</th>
            <th>Assigned to</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.adoId} className={row.outOfScope ? "out-of-scope" : undefined} title={row.outOfScope ? "Out of scope" : undefined}>
              <td>{itemUrlBase ? <a href={`${itemUrlBase}${row.adoId}`} target="_blank" rel="noreferrer">{row.adoId}</a> : row.adoId}</td>
              <td className="title">{row.title}</td>
              <td>{row.type}</td>
              <td>{row.adoState}</td>
              <td>{row.pipelineStatus}</td>
              <td>{row.iterationPath}</td>
              <td>{row.assignedTo ?? "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
