import type { Evidence } from "../../models/Evidence";

// A repo the work touches; evidence from the code proves it, none means the pick is unverified.
export interface RepoPick {
  name: string;
  reason: string;
  evidence: Evidence[];
}
