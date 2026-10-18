import { agentColor } from "@/lib/agentColors";

// An agent's id in its colour (its slot in the config's order, as on the Dashboard).
export function AgentTag({ agent, palette }: { agent: string; palette: string[] }) {
  const slot = palette.indexOf(agent);

  return <span className="agent-tag" style={{ "--c": agentColor(slot < 0 ? palette.length : slot) } as React.CSSProperties}>{agent}</span>;
}
