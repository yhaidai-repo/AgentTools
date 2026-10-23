import type { DataAccessKind } from "@powerloom/db";

// One outside resource's use in the period (the Tools tab), like a note's use on the Vault page.
export interface ResourceUsage {
  kind: DataAccessKind;
  resource: string;
  target: string;
  calls: number;
  ok: number;
  refused: number;
  denied: number;
  failed: number;
  rows: number;
  agents: string[];
  /** The latest call ever, not only in the period; null = never. */
  lastUsed: Date | null;
}
