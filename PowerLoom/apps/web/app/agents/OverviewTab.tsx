import type { ReactNode } from "react";
import { PeriodPicker } from "@/components/PeriodPicker";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAgentTotals } from "@/lib/agentTotals";
import { spentTodayByAgent } from "@/lib/budgetUsage";
import { periodStart } from "@/lib/periodStart";
import { periodOf } from "@/lib/ranges";
import { loadRunCounts } from "@/lib/runCounts";
import { loadSubscriptionStatus } from "@/lib/subscription";
import { AgentsTable } from "./AgentsTable";
import { SubscriptionMeters } from "./SubscriptionMeters";

// The agents with their period (user decision 2026-10-18): the subscription's two limits as meters, one row per agent
// in four columns. The agents are one set for every vault; their runs, tokens and costs are the
// selected vault's (user decision 2026-10-06).
export async function OverviewTab({ vault, params, tabs, paused }: { vault: string; params: { range?: string }; tabs: ReactNode; paused: boolean }) {
  const range = periodOf(params.range);
  const since = await periodStart(range, vault);
  const agents = await getAgentConfig().list();

  return (
    <>
      <div className="tab-bar">
        {tabs}
        <div className="tab-filters"><PeriodPicker value={range} path="/agents" keep={{ tab: "overview" }} /></div>
      </div>
      <SubscriptionMeters statuses={await loadSubscriptionStatus()} />
      <AgentsTable agents={agents} totals={await loadAgentTotals(since, vault)} counts={await loadRunCounts(since, vault)} spentToday={await spentTodayByAgent(agents.map((agent) => agent.id))} range={range} paused={paused} />
    </>
  );
}
