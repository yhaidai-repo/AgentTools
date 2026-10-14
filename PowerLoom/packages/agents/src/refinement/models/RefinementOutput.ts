import type { RelevantDoc } from "../../models/RelevantDoc";
import type { AcGap } from "./AcGap";
import type { RefinementEstimate } from "./RefinementEstimate";
import type { RepoChoice } from "./RepoChoice";
import type { SkillChoice } from "./SkillChoice";

export interface RefinementOutput {
  summary: string;
  scopeIn: string[];
  scopeOut: string[];
  acGaps: AcGap[];
  dependencies: string[];
  repos: RepoChoice[];
  assumptions: string[];
  relevantDocs: RelevantDoc[];
  skills: SkillChoice[];
  estimate: RefinementEstimate;
}
