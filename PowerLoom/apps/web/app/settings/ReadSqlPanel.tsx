import Link from "next/link";
import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { AddSqlConnectionForm } from "./AddSqlConnectionForm";
import { ReadSqlSwitchForm } from "./ReadSqlSwitchForm";
import { SqlConnectionRowForm } from "./SqlConnectionRowForm";

// Read SQL (user decision 2026-10-12): the vault's switch and its SQL Server connections. An agent reads them only with
// its own Read SQL switch on (its Config page).
export function ReadSqlPanel({ enabled, connections }: { enabled: boolean; connections: SqlConnectionRow[] }) {
  return (
    <div className="card">
      <ReadSqlSwitchForm enabled={enabled} />
      <p className="muted">
        Agents may run read-only queries on these databases during their runs; each agent needs its own Read SQL switch on its Config page (<Link href="/agents">Agents</Link>). Whatever a query returns goes to the model provider: connect only databases whose data may leave this PC, with a read-only login (<code>db_datareader</code>).
      </p>
      {connections.length === 0 ? <p className="muted">No connections yet: add one below.</p> : <ConnectionTable connections={connections} />}
      <AddSqlConnectionForm />
    </div>
  );
}

function ConnectionTable({ connections }: { connections: SqlConnectionRow[] }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Enabled</th><th>Name</th><th>Server</th><th>Database</th><th></th></tr>
        </thead>
        <tbody>
          {connections.map((row) => <SqlConnectionRowForm key={row.name} connection={row} />)}
        </tbody>
      </table>
    </div>
  );
}
