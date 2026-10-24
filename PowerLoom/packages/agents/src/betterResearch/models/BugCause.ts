// The bug block of a research result: the cause, how the reported state was confirmed, and whether fixing the cause
// alone removes every symptom.
export interface BugCause {
  cause: string;
  premiseChecked: string;
  fixAloneIsEnough: "yes" | "no" | "unknown";
  fixAloneReason: string;
}
