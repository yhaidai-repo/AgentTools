import Link from "next/link";

export const DASHBOARD_TABS = [
  { key: "application", label: "Application" },
  { key: "agents", label: "Agents" },
  { key: "delivery", label: "Delivery" },
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number]["key"];

export const DEFAULT_DASHBOARD_TAB: DashboardTab = "application";

// Every link names its tab: a link without parameters would reopen the remembered one.
export function DashboardTabs({ active }: { active: DashboardTab }) {
  return (
    <nav className="tabs">
      {DASHBOARD_TABS.map((tab) => (
        <Link key={tab.key} href={`/dashboard?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
