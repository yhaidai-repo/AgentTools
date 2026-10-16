import type { SqlConnectionSettings } from "../models/SqlConnectionSettings";

// What a connection points at, as the data access log shows it.
export function sqlTarget(connection: SqlConnectionSettings): string {
  return `${connection.server}/${connection.database || "default"}`;
}
