import type { DuplicateGuard } from "../DuplicateGuard";
import type { CreatedTask } from "./models/CreatedTask";
import { USER, targetOf } from "./taskTargets";

type ToolText = { text: string; isError?: boolean };

// Notes a checked task for the run's commit, unless it has problems or repeats one already on the PBI; create_task and
// hand_off share the run's list, so `new:<n>` counts both.
export function noteCreatedTask(task: CreatedTask, problems: string[], tasks: CreatedTask[], guard: DuplicateGuard): ToolText {
  if (problems.length > 0) {
    return { text: `Not created, fix and retry: ${problems.join("; ")}.`, isError: true };
  }

  const duplicate = guard.check(guardKindOf(task), task.goal);

  if (duplicate) {
    return { text: duplicate, isError: true };
  }

  tasks.push(task);
  guard.remember(guardKindOf(task), `new:${tasks.length}`, task.goal);

  return { text: `Noted as new:${tasks.length} for ${task.assignee}; it is created when your run succeeds.` };
}

function guardKindOf(task: CreatedTask): string {
  if (task.assignee === USER) {
    return task.kind === "question" ? "question" : "human";
  }

  return targetOf(task.assignee)!.kind;
}
