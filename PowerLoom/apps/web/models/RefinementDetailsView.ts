// The parts of Better Refinement's refinement.details the PBI page shows (the full details are in the refinement note).
export interface RefinementDetailsView {
  status: string;
  affectedAreas: { area: string }[];
  testData: { applicable: boolean; missing: string[] };
  blockers: { what: string; resolvedBy: string }[];
}
