import type { MeetingActionItem } from "./MeetingActionItem";
import type { MeetingPbiMention } from "./MeetingPbiMention";
import type { MeetingParticipant } from "./MeetingParticipant";

// What write_meeting_notes records: the notes of one recorded meeting, rendered into the vault on success.
export interface MeetingNotes {
  title: string;
  summary: string;
  participants: MeetingParticipant[];
  decisions: string[];
  actionItems: MeetingActionItem[];
  pbis: MeetingPbiMention[];
  openQuestions: string[];
  /** Words the transcript got wrong, as heard → as meant (names, terms), so a reader isn't misled. */
  corrections: string[];
}
