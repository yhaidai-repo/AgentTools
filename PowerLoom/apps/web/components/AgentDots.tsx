import { agentColor } from "@/lib/agentColors";

// Who used something, as small dots in each agent's colour and their count (user decision 2026-10-18: a list of nine
// names doesn't fit a row); the names are in the tooltip. `palette` gives each agent its slot.
export function AgentDots({ agents, palette }: { agents: string[]; palette: string[] }) {
  if (agents.length === 0) {
    return <span className="muted">–</span>;
  }

  return (
    <span className="agent-dots" title={agents.join(", ")}>
      {agents.map((agent) => <i key={agent} style={{ background: agentColor(slotOf(agent, palette)) }} />)}
      <span>{agents.length} agent{agents.length === 1 ? "" : "s"}</span>
    </span>
  );
}

function slotOf(agent: string, palette: string[]): number {
  const slot = palette.indexOf(agent);

  return slot < 0 ? palette.length : slot;
}
