import Link from "next/link";

export const PBI_TABS = [
  { key: "ado", label: "Azure DevOps" },
  { key: "agents", label: "Agents" },
  { key: "notes", label: "My notes" },
] as const;

export type PbiTab = (typeof PBI_TABS)[number]["key"];

export const DEFAULT_PBI_TAB: PbiTab = "ado";

export function PbiTabs({ adoId, active }: { adoId: number; active: PbiTab }) {
  return (
    <nav className="tabs">
      {PBI_TABS.map((tab) => (
        <Link key={tab.key} href={`/pbis/${adoId}?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
