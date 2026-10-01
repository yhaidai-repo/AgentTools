export interface RefinementNote {
  adoId: number;
  version: number;
  runId: number | null;
  created: Date;
  summary: string;
  scopeIn: string[];
  scopeOut: string[];
  acGaps: { gap: string; suggestion: string }[];
  dependencies: string[];
  repos: { name: string; reason: string }[];
  assumptions: string[];
}
