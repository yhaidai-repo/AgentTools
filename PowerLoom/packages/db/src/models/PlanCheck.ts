import type { PlanCheckVerdict } from "./PlanCheckVerdict";

export interface PlanCheck {
  verdict: PlanCheckVerdict;
  issues: string[];
}
