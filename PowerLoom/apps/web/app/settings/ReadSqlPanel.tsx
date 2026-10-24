import type { SqlConnectionRow } from "@/models/SqlConnectionRow";
import { AddSqlConnectionForm } from "./AddSqlConnectionForm";
import { ReadSqlSwitchForm } from "./ReadSqlSwitchForm";
import { SqlConnectionRowForm } from "./SqlConnectionRowForm";

// Read SQL (user decision 2026-10-12): the vault's switch and its SQL Server connections, one row each. An agent reads
// them only with its own Read SQL switch on (its Config page).
export function ReadSqlPanel({ enabled, connections }: { enabled: boolean; connections: SqlConnectionRow[] }) {
  return (
    <section className="panel settings-card">
      <ReadSqlSwitchForm enabled={enabled} />
      <div className="settings-body">
        {connections.length === 0 ? <p className="hint">No connections yet.</p> : connections.map((row) => <SqlConnectionRowForm key={row.name} connection={row} />)}
        <AddSqlConnectionForm />
      </div>
    </section>
  );
}
