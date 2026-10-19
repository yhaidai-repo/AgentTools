import type { PreviousRun } from "./PreviousRun";

// Decided before the run row exists: the run's own conversation id (null when the runtime keeps none), the run it
// continues, and why it starts fresh although the task's last run didn't finish.
export interface ConversationPlan {
  id: string | null;
  continues: PreviousRun | null;
  skipped: string | null;
}
