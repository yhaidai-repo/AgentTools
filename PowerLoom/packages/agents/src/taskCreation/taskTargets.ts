import { isCustomTaskType } from "@powerloom/core";
import type { TaskTarget } from "./models/TaskTarget";

export const USER = "user";
// hand_off names the user as a person, the receiver of a human task or a question.
export const PERSON = "person";

// The task types agents may create; any agent that handles a type takes its tasks (user decision 2026-10-13).
const TASK_TARGETS: TaskTarget[] = [
  { type: "refinement", kind: "refinement", scope: "pbi", prefix: "RT", needsDocPath: false, purpose: "Resolves missing requirements or test data for a PBI, recording the answers and usable data references for the waiting task." },
  { type: "research", kind: "research", scope: "pbi", prefix: "AT", needsDocPath: false, purpose: "Answers one question with evidence: why a bug happens, how something works, whether something exists, or which options a spike has." },
  { type: "design", kind: "design", scope: "pbi", prefix: "DT", needsDocPath: false, purpose: "Writes the implementation plan once the problem and its cause are known." },
  { type: "docs", kind: "docs", scope: "global", prefix: "WT", needsDocPath: true, purpose: "Fixes a docs-vault note that is wrong or outdated; give the note's path." },
  { type: "test", kind: "test", scope: "pbi", prefix: "TT", needsDocPath: false, purpose: "Proves the PBI's acceptance criteria end to end: analyses them against the test cases, plans the cases, runs them on a local stack with a recorded browser." },
];

export function allowedTargets(canAssign: string[]): TaskTarget[] {
  const builtIn = TASK_TARGETS.filter((target) => canAssign.includes(target.type));

  return [...builtIn, ...canAssign.filter(isCustomTaskType).map(customTarget)];
}

export function targetOf(type: string): TaskTarget | undefined {
  return TASK_TARGETS.find((target) => target.type === type) ?? (isCustomTaskType(type) ? customTarget(type) : undefined);
}

// A custom task type (user decision 2026-10-24): the agent that handles it takes the task; numbered XT on the PBI.
function customTarget(type: string): TaskTarget {
  return { type, kind: type, scope: "pbi", prefix: "XT", needsDocPath: false, purpose: `A ${type} task for the agent that handles ${type}.` };
}
