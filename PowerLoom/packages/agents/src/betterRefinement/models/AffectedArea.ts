import type { Evidence } from "../../models/Evidence";

// A part of the system the work changes or must not break: a feature, screen, service, event, job or data.
export interface AffectedArea {
  area: string;
  change: string;
  evidence: Evidence[];
}
