// Caps per review run (the agent's Config options); what is left waits for the next task.
export interface ReviewLimits {
  maxNotesPerRun: number;
  maxLinkFixesPerRun: number;
  maxRecordsPerRun: number;
}
