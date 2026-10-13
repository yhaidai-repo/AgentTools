import type { AgentStage } from "./models/AgentStage";
import type { BlockerKind } from "./models/BlockerKind";

// The pipeline agents, in order. An agent without a stage here gets no PBI tasks (e.g. a later tech writer).
export const AGENT_STAGES: Record<string, AgentStage> = {
  refinement: { kind: "refinement", prefix: "RT", running: "refining", waiting: "ready-for-refinement", title: "Refine the PBI" },
  "better-refinement": { kind: "refinement", prefix: "RT", running: "refining", waiting: "ready-for-refinement", title: "Refine the PBI" },
  research: { kind: "research", prefix: "AT", running: "researching", waiting: "needs-research", title: "Research the PBI" },
  "better-research": { kind: "research", prefix: "AT", running: "researching", waiting: "needs-research", title: "Research the PBI" },
  design: { kind: "design", prefix: "DT", running: "designing", waiting: "ready-for-design", title: "Design the implementation" },
};

// What an agent can be told to wait for (AgentConfig `waitFor`); the validator checks each (user decision 2026-10-01).
export const BLOCKER_KINDS: BlockerKind[] = [
  { key: "humanItems", label: "Questions and human tasks", description: "No open question or human task on the PBI." },
  { key: "linkedDocuments", label: "Linked documents", description: "Every document the PBI links has its content attached, or the user declined it." },
  { key: "drafts", label: "Vault drafts", description: "Every vault draft another agent captured for the PBI is merged." },
  { key: "otherAgentTasks", label: "Other agents' tasks", description: "No other agent has an open task on the PBI (e.g. design waits until all research is done)." },
];

export function agentIdOf(assignee: string): string | null {
  return assignee.startsWith("agent:") ? assignee.slice("agent:".length) : null;
}
