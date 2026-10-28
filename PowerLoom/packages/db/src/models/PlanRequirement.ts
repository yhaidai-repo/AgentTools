// A requirement of REQUIREMENTS.md and the plans that cover it (their frontmatter `requirements`); none = not covered.
export interface PlanRequirement {
  id: string;
  text: string;
  complete: boolean;
  plans: string[];
}
