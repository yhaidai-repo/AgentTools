import type { RelevantDoc } from "../../models/RelevantDoc";
import type { CodeRef } from "./CodeRef";
import type { Evidence } from "./Evidence";

export interface ResearchResultOutput {
  conclusion: string;
  findings: string[];
  evidence: Evidence[];
  confidence: "high" | "medium" | "low";
  /** Handoff to design: docs and code locations worth reading. */
  relevantDocs: RelevantDoc[];
  codeRefs: CodeRef[];
}
