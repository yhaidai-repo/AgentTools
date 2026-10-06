import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { NoVault } from "@/components/NoVault";
import { currentVault, vaultRootOf } from "@/lib/currentVault";
import { MaintenanceTab } from "./MaintenanceTab";
import { UsageTab } from "./UsageTab";
import { DEFAULT_VAULT_TAB, VAULT_TABS, VaultTabs } from "./VaultTabs";

export const dynamic = "force-dynamic";

type SearchParams = Promise<{ tab?: string; range?: string; agent?: string; unused?: string }>;

// The selected vault (user decision 2026-10-05; before, the one docs vault), in tabs (user decision 2026-10-05): Usage (what the
// tech-writer wrote, most used and unused notes) and Maintenance (WWW records, known issues, open questions, jobs).
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

  return (
    <>
      <h1>Vault</h1>
      <RememberFilters />
      <VaultTabs active={tab} />
      {tab === "maintenance" ? <MaintenanceTab root={root} vault={vault} /> : <UsageTab root={root} vault={vault} params={params} />}
    </>
  );
}
