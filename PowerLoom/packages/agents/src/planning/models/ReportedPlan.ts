import type { PlanCheck } from "@powerloom/db";

// What only the agent knows of its plan: no file holds the plan checker's last verdict, and the style defaults it took
// are its own.
export interface ReportedPlan {
  summary: string;
  checker: PlanCheck;
  assumptions: string[];
}
