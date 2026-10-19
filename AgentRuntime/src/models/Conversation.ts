// The provider conversation a run writes to: `id` is new for every run; `continues` names the earlier run's
// conversation it picks up (its whole history is copied into `id`), or null for a fresh start.
export interface Conversation {
  id: string;
  continues: string | null;
}
