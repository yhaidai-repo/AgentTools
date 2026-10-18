import { AutoRefresh } from "@/components/AutoRefresh";
import { NoVault } from "@/components/NoVault";
import { RememberFilters } from "@/components/RememberFilters";
import { currentVault } from "@/lib/currentVault";
import { rememberedParams } from "@/lib/rememberedFilters";
import { loadSystemStatus } from "@/lib/systemStatus";
import { AgentsTab } from "./agents/AgentsTab";
import { ApplicationTab } from "./application/ApplicationTab";
import { DeliveryTab } from "./delivery/DeliveryTab";
import { DASHBOARD_TABS, DEFAULT_DASHBOARD_TAB, DashboardTabs } from "./DashboardTabs";

export const dynamic = "force-dynamic";

const STATUS_REFRESH_MS = 30_000;

type SearchParams = Promise<{ tab?: string; focus?: string; mark?: string; range?: string; sprint?: string; metric?: string }>;

// The home page (user decision 2026-10-11): Application (PowerLoom's health and what needs attention), Agents (costs,
// runs, errors) and Delivery (sprints, estimates, the pipeline). Every tab shows the selected vault (user decision
// 2026-10-18: all pages are in the vault's scope).
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Dashboard" />;
  }

  const params = await rememberedParams("/dashboard", await searchParams);
  const tab = DASHBOARD_TABS.find((choice) => choice.key === params.tab)?.key ?? DEFAULT_DASHBOARD_TAB;

  return (
    <>
      <div className="page-head">
        <h1>Dashboard</h1>
        <AutoRefresh active intervalMs={STATUS_REFRESH_MS} />
      </div>
      <RememberFilters vault={vault} />
      <DashboardTabs active={tab} />
      {tab === "application" && <ApplicationTab status={await loadSystemStatus()} vault={vault} focus={params.focus ?? null} mark={params.mark ?? null} />}
      {tab === "agents" && <AgentsTab vault={vault} range={params.range} metric={params.metric} />}
      {tab === "delivery" && <DeliveryTab vault={vault} sprint={params.sprint} />}
    </>
  );
}
