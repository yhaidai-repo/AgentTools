import type { MeetingFollowUp } from "./MeetingFollowUp";
import type { MeetingNotes } from "./MeetingNotes";

// What a run collects; written only when it succeeds.
export interface MeetingNotesDraft {
  notes: MeetingNotes | null;
  followUps: MeetingFollowUp[];
}
