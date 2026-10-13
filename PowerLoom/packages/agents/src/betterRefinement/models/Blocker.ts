import type { Evidence } from "../../models/Evidence";

// What stops development, and the task that resolves it (an item id; `new:<n>` until the run's commit).
export interface Blocker {
  what: string;
  resolvedBy: string;
  evidence: Evidence[];
}
