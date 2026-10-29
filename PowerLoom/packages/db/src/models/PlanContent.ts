import type { PhasePlan } from "./PhasePlan";
import type { PlanAutoChoice } from "./PlanAutoChoice";
import type { PlanCheck } from "./PlanCheck";
import type { PlanDecision } from "./PlanDecision";
import type { PlanRequirement } from "./PlanRequirement";
import type { PlanRisk } from "./PlanRisk";

// A PBI's plan as the planning agent's write_plan read it from the worktree's .planning/ folder; the agent adds only the
// summary, the checker's verdict and the assumptions it took.
export interface PlanContent {
  summary: string;
  decisions: PlanDecision[];
  autoChoices: PlanAutoChoice[];
  requirements: PlanRequirement[];
  plans: PhasePlan[];
  checker: PlanCheck;
  risks: PlanRisk[];
  assumptions: string[];
}
