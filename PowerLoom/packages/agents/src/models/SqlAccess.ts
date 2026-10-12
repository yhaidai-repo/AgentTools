import type { SqlConnectionSettings } from "@powerloom/core";
import type { SqlReader } from "@powerloom/sql";

// The run's vault's Read SQL: its enabled connections while the vault's switch is on.
export interface SqlAccess {
  reader: SqlReader;
  connections: SqlConnectionSettings[];
}
