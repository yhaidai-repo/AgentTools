import type { SqlConnectionSettings } from "../models/SqlConnectionSettings";

// What a read points at, as the data access log shows it: the connection's server and the database the call chose, or
// the connection's own.
export function sqlTarget(connection: SqlConnectionSettings, database?: string): string {
  return `${connection.server}/${database?.trim() || connection.database || "default"}`;
}
