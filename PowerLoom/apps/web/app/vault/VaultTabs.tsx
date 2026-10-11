import Link from "next/link";

export const VAULT_TABS = [
  { key: "usage", label: "Usage" },
  { key: "maintenance", label: "Maintenance" },
] as const;

export type VaultTab = (typeof VAULT_TABS)[number]["key"];

export const DEFAULT_VAULT_TAB: VaultTab = "usage";

// Every link names its tab: a link without parameters would reopen the remembered one.
export function VaultTabs({ active }: { active: VaultTab }) {
  return (
    <nav className="tabs">
      {VAULT_TABS.map((tab) => (
        <Link key={tab.key} href={`/vault?tab=${tab.key}`} className={tab.key === active ? "active" : undefined}>{tab.label}</Link>
      ))}
    </nav>
  );
}
