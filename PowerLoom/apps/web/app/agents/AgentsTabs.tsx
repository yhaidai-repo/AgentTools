import Link from "next/link";

// Runs is a tab of Agents (user decision 2026-10-18), no longer a page of its own.
export const AGENTS_TABS = [
  { key: "overview", label: "Overview" },
  { key: "runs", label: "Runs" },
  { key: "tools", label: "Tools" },
] as const;

export type AgentsTab = (typeof AGENTS_TABS)[number]["key"];

export const DEFAULT_AGENTS_TAB: AgentsTab = "overview";

// Every link names its tab: a link without parameters would reopen the remembered one (as the Vault page does).
export function AgentsTabs({ active }: { active: AgentsTab }) {
  return (
    <nav className="tabs">
      {AGENTS_TABS.map((tab) => (
        <Link key={tab.key} href={`/agents?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
