import type { BlockerKind } from "./models/BlockerKind";

// What an agent can be told to wait for (AgentConfig `waitFor`); the validator checks each (user decision 2026-10-01).
export const BLOCKER_KINDS: BlockerKind[] = [
  { key: "humanItems", label: "Questions and human tasks", description: "No open question or human task on the PBI." },
  { key: "linkedDocuments", label: "Linked documents", description: "Every document the PBI links has its content attached, or the user declined it." },
  { key: "drafts", label: "Vault drafts", description: "Every vault draft another agent captured for the PBI is merged." },
  { key: "otherAgentTasks", label: "Other agents' tasks", description: "No other agent has an open task on the PBI (e.g. design waits until all research is done)." },
];

// A task for any agent that takes its type (user decision 2026-10-13: task types, not agent types); `agent:<id>` pins
// one agent.
export const ANY_AGENT = "agent:*";

// The task types agents take (an agent's `handles`) and the ones agents may create for each other (`canAssign`).
export const AGENT_TASK_TYPES = ["refinement", "research", "design", "docs", "review", "vault-review", "meeting", "test"];
export const CREATABLE_TASK_TYPES = ["research", "design", "docs", "test"];
// The task types the user creates on the Tasks page (user decision 2026-10-14; the vault review since 2026-10-18);
// PowerLoom's TaskCreation checks them.
export const USER_TASK_TYPES = ["refinement", "research", "design", "docs", "vault-review", "test"];

// Who works on an agent task, for display: the pinned agent, or any agent taking its type.
export function workerLabel(assignee: string, kind: string): string {
  return assignee === ANY_AGENT ? `any agent taking ${kind} tasks` : (agentIdOf(assignee) ?? assignee);
}

export function agentIdOf(assignee: string): string | null {
  return assignee.startsWith("agent:") ? assignee.slice("agent:".length) : null;
}
