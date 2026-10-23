import type { RegisterRow } from "./RegisterRow";

// The three registers of the Maintenance tab, as rows; a register not asked for is empty.
export interface VaultRegisterRows {
  www: RegisterRow[];
  issues: RegisterRow[];
  questions: RegisterRow[];
}
