import type { DesignAlternative, DesignPlanStep, DesignRisk, DesignTest } from "@adoa/db";
import type { DesignEstimate } from "./DesignEstimate";

export interface DesignOutput {
  approach: string;
  alternatives: DesignAlternative[];
  plan: DesignPlanStep[];
  risks: DesignRisk[];
  tests: DesignTest[];
  estimate: DesignEstimate;
  assumptions: string[];
}
