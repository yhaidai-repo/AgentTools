// How far one plan got: every task done with its SUMMARY.md written, some tasks done, or none started.
export const BUILD_PLAN_STATUSES = ["done", "partial", "pending"] as const;

export type BuildPlanStatus = typeof BUILD_PLAN_STATUSES[number];
