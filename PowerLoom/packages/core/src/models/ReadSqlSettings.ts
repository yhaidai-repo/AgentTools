import type { SqlConnectionSettings } from "./SqlConnectionSettings";

// A vault's Read SQL (user decision 2026-10-12): agents with the integration switched on read these SQL Server databases
// while the vault's switch is on. Saved by PowerLoom's backend; read here.
export interface ReadSqlSettings {
  enabled: boolean;
  connections: SqlConnectionSettings[];
}
