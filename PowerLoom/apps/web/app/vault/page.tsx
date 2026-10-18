import { NoVault } from "@/components/NoVault";
import { RememberFilters } from "@/components/RememberFilters";
import { currentVault, vaultRootOf } from "@/lib/currentVault";
import { rememberedParams } from "@/lib/rememberedFilters";
import { MaintenanceTab } from "./MaintenanceTab";
import { UsageTab } from "./UsageTab";
import { DEFAULT_VAULT_TAB, VAULT_TABS, VaultTabs } from "./VaultTabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string; range?: string; agent?: string; unused?: string; page?: string; size?: string; register?: string; show?: string }>;

// The selected vault (user decision 2026-10-05; before, the one docs vault), in tabs (user decision 2026-10-05): Usage (what the
// tech-writer wrote, most used and unused notes) and Maintenance (jobs, WWW records, known issues, open questions, trash).
export default async function VaultPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Vault" />;
  }

  const root = vaultRootOf(vault);

  if (!root) {
    return <><h1>Vault</h1><p className="result-error">The vaults root isn&apos;t mounted for the web (VAULTS_DIR).</p></>;
  }

  const params = await rememberedParams("/vault", await searchParams);
  const tab = VAULT_TABS.find((choice) => choice.key === params.tab)?.key ?? DEFAULT_VAULT_TAB;
  const tabs = <VaultTabs active={tab} />;

  return (
    <>
      <div className="page-head"><h1>Vault</h1></div>
      <RememberFilters />
      {tab === "maintenance" ? <MaintenanceTab root={root} vault={vault} params={params} tabs={tabs} /> : <UsageTab root={root} vault={vault} params={params} tabs={tabs} />}
    </>
  );
}
