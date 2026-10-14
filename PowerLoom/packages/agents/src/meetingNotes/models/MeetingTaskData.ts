// `data` of a meeting task (MT-…), as PowerLoom's meetings import writes it (Features/Meetings, MeetingTaskCreation).
export interface MeetingTaskData {
  sourceRef: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  speakers: string[];
  transcriptNote: string;
}
