import type { RelevantDoc } from "../../models/RelevantDoc";
import type { AcGap } from "./AcGap";
import type { RepoChoice } from "./RepoChoice";

export interface RefinementOutput {
  summary: string;
  scopeIn: string[];
  scopeOut: string[];
  acGaps: AcGap[];
  dependencies: string[];
  repos: RepoChoice[];
  assumptions: string[];
  relevantDocs: RelevantDoc[];
}
