import { PostgresAgentConfigStore, type AgentDefinition } from "@agenttools/config";
import type { FlowAgent } from "@/models/FlowAgent";
import { getPool } from "./db";

export interface AgentPalette {
  agents: FlowAgent[];
  /** Where the list came from: the DB, or the stub (FLOW_AGENTS_STUB=1). */
  source: "database" | "stub";
  /** Set when the DB read failed; the palette is then empty. */
  error: string | null;
}

// Today's agents for the palette, read server-side from agent_config.agent (never from the browser).
// FLOW_AGENTS_STUB=1 serves a fixed list instead, for a PC without the compose stack.
export async function loadAgentPalette(): Promise<AgentPalette> {
  if (process.env.FLOW_AGENTS_STUB === "1") {
    return { agents: STUB_AGENTS, source: "stub", error: null };
  }

  try {
    const definitions = await new PostgresAgentConfigStore(getPool()).list();

    return { agents: definitions.map(toFlowAgent), source: "database", error: null };
  } catch (error) {
    return { agents: [], source: "database", error: error instanceof Error ? error.message : String(error) };
  }
}

function toFlowAgent(agent: AgentDefinition): FlowAgent {
  return {
    id: agent.id,
    label: agent.label,
    description: agent.description,
    enabled: agent.enabled,
    handles: [...agent.handles],
    canAssign: [...agent.canAssign],
  };
}

const STUB_AGENTS: FlowAgent[] = [
  { id: "research", label: "Research", description: "Answers research tasks on a PBI.", enabled: true, handles: ["research"], canAssign: [] },
  { id: "refinement", label: "Refinement", description: "Refines a PBI.", enabled: true, handles: ["refinement"], canAssign: ["research"] },
  { id: "design", label: "Design", description: "Designs the solution.", enabled: true, handles: ["design"], canAssign: ["research"] },
  { id: "planning", label: "Planning", description: "Plans the implementation.", enabled: true, handles: ["planning"], canAssign: ["research", "design"] },
  { id: "coding", label: "Coding", description: "Implements the plan.", enabled: true, handles: ["implementation"], canAssign: ["research"] },
  { id: "reviewer", label: "Reviewer", description: "Reviews pull requests.", enabled: true, handles: ["review"], canAssign: [] },
];
