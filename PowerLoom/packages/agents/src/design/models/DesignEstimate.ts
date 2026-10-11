// Human h = a developer without an agent; agent h = an agent implementing the plan (user decision 2026-10-02).
export interface DesignEstimate {
  humanHours: number;
  agentHours: number;
  complexity: number;
  confidence: "high" | "medium" | "low";
  /** What drives the numbers. */
  basis: string;
}
