// One record_estimate call. Human h = a developer without an agent; agent h = an agent implementing it (user decision
// 2026-10-02).
export interface EstimateDraft {
  humanHours: number;
  agentHours: number;
  /** 1 trivial … 5 cross-system or unclear; null when the agent didn't rate it. */
  complexity: number | null;
  confidence: "high" | "medium" | "low" | null;
  /** What drives the numbers. */
  basis: string;
}
