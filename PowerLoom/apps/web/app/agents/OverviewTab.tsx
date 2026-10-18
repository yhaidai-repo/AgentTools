import type { ReactNode } from "react";
import { SegLinks } from "@/components/SegLinks";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAgentTotals } from "@/lib/agentTotals";
import { loadDeadLetters } from "@/lib/deadLetters";
import { DEFAULT_RANGE, RANGES, rangeOptions, rangeStart } from "@/lib/ranges";
import { loadRunCounts } from "@/lib/runCounts";
import { loadSubscriptionStatus } from "@/lib/subscription";
import { AgentsTable } from "./AgentsTable";
import { DeadLetters } from "./DeadLetters";
import { SubscriptionMeters } from "./SubscriptionMeters";

// The agents with their period (user decision 2026-10-18): the subscription's two limits as meters, one row per agent
// in four columns, and the dead letters. The agents are one set for every vault; their runs, tokens and costs are the
// selected vault's (user decision 2026-10-06).
export async function OverviewTab({ vault, params, tabs, paused }: { vault: string; params: { range?: string }; tabs: ReactNode; paused: boolean }) {
  const range = params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE;
  const since = rangeStart(range);
  const agents = await getAgentConfig().list();

  return (
    <>
      <div className="tab-bar">
        {tabs}
        <div className="tab-filters"><SegLinks name="range" value={range} options={rangeOptions()} path="/agents" keep={{ tab: "overview" }} small /></div>
      </div>
      <SubscriptionMeters statuses={await loadSubscriptionStatus()} />
      <AgentsTable agents={agents} totals={await loadAgentTotals(since, vault)} counts={await loadRunCounts(since, vault)} range={range} paused={paused} />
      <DeadLetters letters={await loadDeadLetters(since)} />
    </>
  );
}
