import type { CreatedTask } from "../../taskCreation/models/CreatedTask";

// A task or question the meeting asks for, with the PBI it belongs to (null: the meeting's vault, numbered across the app).
export interface MeetingFollowUp {
  pbiId: number | null;
  task: CreatedTask;
}
