// The design note's data; plain shapes like RefinementNote, so the renderer stays free of the DB package.
export interface DesignNote {
  adoId: number;
  version: number;
  runId: number | null;
  created: Date;
  approach: string;
  alternatives: { option: string; pros: string[]; cons: string[]; whyNot: string }[];
  plan: { step: string; repo: string; locations: string[]; change: string; agentDoable: boolean }[];
  risks: { risk: string; impact: string; mitigation: string }[];
  tests: { kind: string; case: string }[];
  assumptions: string[];
  estHumanH: string | null;
  estAgentH: string | null;
  complexity: number | null;
  confidence: string | null;
  estimateBasis: string;
}
