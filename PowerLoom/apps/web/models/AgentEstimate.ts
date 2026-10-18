// What the agents estimated, split (user request 2026-10-18): the time a developer needs without an agent, and the
// time with an agent doing the work. Hours; null when no agent estimated it.
export interface AgentEstimate {
  /** The design's human estimate, else the refinement's (refinement estimates for a developer only). */
  humanHours: number | null;
  /** The design's agent estimate; refinement has none. */
  agentHours: number | null;
}
