// A chat's facts for a docs vault draft: the agents' vault_capture fields, written at once (no run to wait for).
export interface VaultDraftInput {
  project: string;
  name: string;
  title: string;
  target: string;
  captured: string[];
  assumptions: string[];
  toFill: string[];
  /** Who captured it, e.g. "session finding: powerloom chat:claude-code". */
  source: string;
}
