// ok; refused = a guard said no (read-only check, cap); denied = the outside system refused access; failed = any other error.
export type DataAccessOutcome = "ok" | "refused" | "denied" | "failed";
