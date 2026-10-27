import type { CreatedTask } from "./CreatedTask";
import type { NewTask } from "./NewTask";
import type { Outcome } from "./Outcome";
import type { SavedSchedule } from "./SavedSchedule";
import type { TaskEdit } from "./TaskEdit";
import type { TaskScheduleInput } from "./TaskScheduleInput";

// The task and schedule changes the web made through the API directly before stage 3 of the powerloom-mcp design.
export interface TaskWorkPort {
  createTask(task: NewTask, actor: string): Promise<Outcome<CreatedTask>>;
  saveSchedule(schedule: TaskScheduleInput): Promise<Outcome<SavedSchedule>>;
  deleteSchedule(id: number): Promise<Outcome<void>>;
  // Creates the schedule's task now unless one of its tasks still waits; what happened.
  tickSchedule(id: number): Promise<Outcome<string>>;
  // The user's notes on an agent task; `loadedText` as for a PBI's notes.
  saveTaskNotes(itemId: string, text: string, loadedText: string): Promise<Outcome<string>>;
  // An agent task's title, description and acceptance criteria, while it isn't running; its id.
  editTask(edit: TaskEdit): Promise<Outcome<string>>;
}
