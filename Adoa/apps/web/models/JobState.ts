// What a queue is doing now.
export interface JobState {
  waiting: number;
  running: number;
  lastCompleted: Date | null;
}
