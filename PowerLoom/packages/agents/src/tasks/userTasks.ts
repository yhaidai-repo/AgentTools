import type { localItem } from "@powerloom/db";
import type { UserTaskData } from "./models/UserTaskData";

type ItemRow = typeof localItem.$inferSelect;

const CREATED_BY_USER = "user";

export const CHECK_EACH_CRITERION = "Your result says for each acceptance criterion: met or not met, with the evidence.";

// Tasks the user creates on the Tasks page (user decision 2026-10-14) carry a description (the body) and acceptance
// criteria (`doneWhen`); agents get both, whatever their task type.
export function isUserTask(task: ItemRow): boolean {
  return userTaskData(task).createdBy === CREATED_BY_USER;
}

// The criteria and the rule that the result answers each one; empty for tasks the user didn't create.
export function acceptanceCriteriaBlock(task: ItemRow): string {
  if (!isUserTask(task)) {
    return "";
  }

  return ["<acceptance-criteria>", userTaskData(task).doneWhen ?? "", "</acceptance-criteria>", CHECK_EACH_CRITERION].join("\n");
}

// For agents whose message is about a PBI or a note, not the task: what the user asked for and when it is done.
export function userRequestBlock(task: ItemRow): string {
  if (!isUserTask(task)) {
    return "";
  }

  const request = ["<user-request>", `Task ${task.id}: ${task.title}`, task.body ?? "", "</user-request>"].join("\n");

  return [request, acceptanceCriteriaBlock(task)].join("\n\n");
}

function userTaskData(task: ItemRow): UserTaskData {
  return (task.data ?? {}) as UserTaskData;
}
