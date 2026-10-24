import type { DataAccessKind } from "@powerloom/db";

// One resource a vault's agents may read today (Settings): a Read SQL connection or a Read Azure resource.
export interface ConfiguredResource {
  kind: DataAccessKind;
  resource: string;
  target: string;
}
