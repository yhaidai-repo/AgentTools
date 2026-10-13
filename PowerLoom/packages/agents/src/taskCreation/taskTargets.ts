import type { TaskTarget } from "./models/TaskTarget";

export const USER = "user";

// The agents that take created tasks. An agent id missing here can sit in canAssign but gets no tasks.
const TASK_TARGETS: TaskTarget[] = [
  { agentId: "research", kind: "research", scope: "pbi", prefix: "AT", needsDocPath: false, purpose: "Answers one question from the code and docs, with evidence." },
  { agentId: "better-research", kind: "research", scope: "pbi", prefix: "AT", needsDocPath: false, purpose: "Answers one question with evidence: why a bug happens, how something works, whether something exists, or which options a spike has. Reads code, docs, data and logs." },
  { agentId: "design", kind: "design", scope: "pbi", prefix: "DT", needsDocPath: false, purpose: "Writes the implementation plan once the problem and its cause are known." },
  { agentId: "tech-writer", kind: "docs", scope: "global", prefix: "WT", needsDocPath: true, purpose: "Fixes a docs-vault note that is wrong or outdated; give the note's path." },
];

export function allowedTargets(canAssign: string[]): TaskTarget[] {
  return TASK_TARGETS.filter((target) => canAssign.includes(target.agentId));
}

export function targetOf(agentId: string): TaskTarget | undefined {
  return TASK_TARGETS.find((target) => target.agentId === agentId);
}
