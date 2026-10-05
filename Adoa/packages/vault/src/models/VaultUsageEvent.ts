// One line of VaultUsage's log (`<vault>/.usage/usage.jsonl`): the Vault page and the vault review read it.
export interface VaultUsageEvent {
  at: Date;
  /** Relative to the vault root, `/` separators. */
  file: string;
  kind: "read" | "search" | "write" | "shell";
  /** e.g. "claude-code", "adoa:research". */
  agent: string;
}
