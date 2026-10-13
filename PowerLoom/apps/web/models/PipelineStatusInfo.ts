// How the dashboard explains one pipeline status: a plain name, what it means, and who moves the PBI on.
export interface PipelineStatusInfo {
  label: string;
  meaning: string;
  /** "agent" works now, "queue" waits for an agent's schedule, "you" waits for the user, "–" is an end state. */
  who: "agent" | "queue" | "you" | "–";
}
