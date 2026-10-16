import { AutoRefresh } from "@/components/AutoRefresh";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { loadSystemStatus } from "@/lib/systemStatus";
import { AgentsTab } from "./agents/AgentsTab";
import { ApplicationTab } from "./application/ApplicationTab";
import { DeliveryTab } from "./delivery/DeliveryTab";
import { DASHBOARD_TABS, DEFAULT_DASHBOARD_TAB, DashboardTabs } from "./DashboardTabs";

export const dynamic = "force-dynamic";

const STATUS_REFRESH_MS = 30_000;

type SearchParams = Promise<{ tab?: string; focus?: string; mark?: string; range?: string; sprint?: string; agent?: string; metric?: string }>;

// The home page (user decision 2026-10-11): Application (the architecture scheme with PowerLoom's live status and what
// needs attention), Agents (costs, runs, errors) and Delivery (sprints, throughput).
export default async function DashboardPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await rememberedParams("/dashboard", await searchParams);
  const tab = DASHBOARD_TABS.find((choice) => choice.key === params.tab)?.key ?? DEFAULT_DASHBOARD_TAB;

  return (
    <>
      <div className="section-head">
        <h1>Dashboard</h1>
        <AutoRefresh active intervalMs={STATUS_REFRESH_MS} />
      </div>
      <RememberFilters />
      <DashboardTabs active={tab} />
      {tab === "application" && <ApplicationTab status={await loadSystemStatus()} focus={params.focus ?? null} mark={params.mark ?? null} />}
      {tab === "agents" && <AgentsTab range={params.range} agent={params.agent} metric={params.metric} />}
      {tab === "delivery" && <DeliveryTab sprint={params.sprint} />}
    </>
  );
}
