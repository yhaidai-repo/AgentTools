import type { ActionResult } from "./ActionResult";

// Adding a vault also tells which one, so the menu can select it.
export interface AddVaultResult extends ActionResult {
  vault: string | null;
}
