// What gsd-plan-checker returned last: `## VERIFICATION PASSED`, `## ISSUES FOUND`, or no check ran.
export const PLAN_CHECK_VERDICTS = ["passed", "issues", "not-run"] as const;

export type PlanCheckVerdict = typeof PLAN_CHECK_VERDICTS[number];
