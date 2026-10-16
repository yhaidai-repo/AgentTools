import type { Evidence } from "../../models/Evidence";

// One acceptance criterion of a linked PBI, checked against the change.
export interface CriterionCheck {
  pbi: string;
  criterion: string;
  status: "met" | "partly" | "not_met" | "not_verifiable" | "out_of_scope";
  note: string;
  evidence: Evidence[];
}
