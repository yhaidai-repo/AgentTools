// What failed, as an agent reports it (report_failure): see design-run-failure-report.md. `source_unreachable` covers a
// page that didn't load and search engines that didn't respond; `no_results` is an unexpected empty search.
export const FAILURE_KINDS = ["no_results", "source_unreachable", "tool_error", "access_missing", "limit_reached", "other"] as const;

export type FailureKind = typeof FAILURE_KINDS[number];
