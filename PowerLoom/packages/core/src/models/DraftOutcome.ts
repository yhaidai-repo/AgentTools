// What VaultCapture did with a draft: created or appended (its path), or rejected with what to fix.
export interface DraftOutcome {
  ok: boolean;
  mode: string;
  path: string | null;
  errors: string[];
}
