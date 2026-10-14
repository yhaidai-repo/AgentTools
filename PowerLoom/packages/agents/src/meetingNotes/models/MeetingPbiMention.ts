// A work item the meeting talked about: its id when known (said, or found with find_pbis), what was said about it.
export interface MeetingPbiMention {
  id: number | null;
  title: string;
  said: string;
  saidAt: string;
}
