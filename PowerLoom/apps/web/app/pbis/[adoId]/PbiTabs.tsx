import Link from "next/link";

// Agents first (user decision 2026-10-18): what the agents made of the PBI and what waits on you.
export const PBI_TABS = [
  { key: "agents", label: "Agents" },
  { key: "ado", label: "Azure DevOps" },
  { key: "notes", label: "My notes" },
] as const;

export type PbiTab = (typeof PBI_TABS)[number]["key"];

export const DEFAULT_PBI_TAB: PbiTab = "agents";

// `waiting`: how many items wait on you, shown on the Agents tab.
export function PbiTabs({ adoId, active, waiting }: { adoId: number; active: PbiTab; waiting: number }) {
  return (
    <nav className="tabs">
      {PBI_TABS.map((tab) => (
        <Link key={tab.key} href={`/pbis/${adoId}?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>{tab.label}{tab.key === "agents" && waiting > 0 && <b className="tab-count">{waiting}</b>}</Link>
      ))}
    </nav>
  );
}
