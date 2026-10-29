import type { ShippedNote } from "./ShippedNote";

// What the code shipped for a system agent's code-owned fields when they were last applied to its stored copy. A field
// whose shipped value is unchanged keeps the stored one (an edit made since); a changed one takes the code's again.
export interface ShippedFields {
  label: string;
  description: string;
  /** Hash of the agent's prompt file as shipped ("" without a file); the text itself stays in the code. */
  prompt: string;
  skills: string[];
  canAssign: string[];
  handles: string[];
  waitFor: string[];
  /** The latest refresh that replaced stored values, for the agent's page. */
  note?: ShippedNote;
}
