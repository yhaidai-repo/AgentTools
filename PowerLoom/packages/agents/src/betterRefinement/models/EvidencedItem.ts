import type { Evidence } from "../../models/Evidence";

// One statement of a refinement with the sources that show it: a source collected, a dependency.
export interface EvidencedItem {
  what: string;
  evidence: Evidence[];
}
