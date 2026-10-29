import type { DesignAlternative, DesignPlanStep, DesignRisk, DesignTest } from "@powerloom/db";

export interface DesignOutput {
  approach: string;
  alternatives: DesignAlternative[];
  plan: DesignPlanStep[];
  risks: DesignRisk[];
  tests: DesignTest[];
  assumptions: string[];
}
