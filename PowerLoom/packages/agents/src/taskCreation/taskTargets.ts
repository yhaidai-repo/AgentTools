import type { TaskTarget } from "./models/TaskTarget";

export const USER = "user";

// The task types agents may create; any agent that handles a type takes its tasks (user decision 2026-10-13).
const TASK_TARGETS: TaskTarget[] = [
  { type: "research", kind: "research", scope: "pbi", prefix: "AT", needsDocPath: false, purpose: "Answers one question with evidence: why a bug happens, how something works, whether something exists, or which options a spike has." },
  { type: "design", kind: "design", scope: "pbi", prefix: "DT", needsDocPath: false, purpose: "Writes the implementation plan once the problem and its cause are known." },
  { type: "docs", kind: "docs", scope: "global", prefix: "WT", needsDocPath: true, purpose: "Fixes a docs-vault note that is wrong or outdated; give the note's path." },
];

export function allowedTargets(canAssign: string[]): TaskTarget[] {
  return TASK_TARGETS.filter((target) => canAssign.includes(target.type));
}

export function targetOf(type: string): TaskTarget | undefined {
  return TASK_TARGETS.find((target) => target.type === type);
}
