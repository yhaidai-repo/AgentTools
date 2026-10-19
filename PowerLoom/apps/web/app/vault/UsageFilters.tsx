import { LinkPicker } from "@/components/LinkPicker";
import { PeriodPicker } from "@/components/PeriodPicker";
import { ALL_AGENTS } from "@/lib/vaultUsage";
import { vaultUrl } from "@/lib/vaultUrl";

// The period as the shared switch and the agent as the shared dropdown (user, 2026-10-18: no unstyled system lists);
// both live in the URL.
export function UsageFilters({ range, agent, agents }: { range: string; agent: string; agents: string[] }) {
  const choices = agents.map((choice) => ({ key: choice, label: agentLabel(choice), href: vaultUrl({ tab: "usage", range, agent: choice }) }));

  return (
    <div className="tab-filters">
      <PeriodPicker value={range} path="/vault" keep={{ tab: "usage", agent }} />
      <LinkPicker label="Agent" value={agent} choices={choices} />
    </div>
  );
}

export function agentLabel(agent: string): string {
  if (agent === ALL_AGENTS) {
    return "All agents";
  }

  return agent === "PowerLoom" ? "PowerLoom (all its agents)" : agent;
}
