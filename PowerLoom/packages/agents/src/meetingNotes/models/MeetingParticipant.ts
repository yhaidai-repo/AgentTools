// A voice of the transcript: its label there ("Me", "Anna", "Speaker 3") and, when the talk makes it clear, who it is.
export interface MeetingParticipant {
  label: string;
  who: string | null;
}
