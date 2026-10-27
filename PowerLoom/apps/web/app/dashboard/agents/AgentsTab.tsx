import { PeriodPicker } from "@/components/PeriodPicker";
import { loadAgentActivity, loadDailyActivity } from "@/lib/agentActivity";
import { getAgentConfig } from "@/lib/agentConfig";
import { agentMetricOf } from "@/lib/agentMetrics";
import { loadFailureGroups } from "@/lib/failedRuns";
import { loadHeldTasks } from "@/lib/heldTasks";
import { loadCostliestPbis } from "@/lib/pbiCosts";
import { periodStart } from "@/lib/periodStart";
import { periodOf, periodPhrase } from "@/lib/ranges";
import { loadSystemStatus } from "@/lib/systemStatus";
import { vaultRunsInProgress } from "@/lib/vaultRunsInProgress";
import { ActivityCharts } from "./ActivityCharts";
import { AgentsBand } from "./AgentsBand";
import { AgentTable } from "./AgentTable";
import { CostliestPbis } from "./CostliestPbis";
import { CostPerMinute } from "./CostPerMinute";
import { HeldTasks } from "./HeldTasks";
import { RecentFailures } from "./RecentFailures";
import { RunsInProgress } from "./RunsInProgress";

const RECENT_FAILURES = 8;
const COSTLIEST_PBIS = 10;

interface AgentsTabProps {
  vault: string;
  range?: string;
  metric?: string;
}

// The vault's agents (user decision 2026-10-18: the dashboard shows the selected vault): the period's totals, cost,
// tokens or run time and runs per day, each agent's period and today against its daily limit, what runs and what waits,
// the costliest PBIs and the latest distinct failures.
export async function AgentsTab({ vault, range, metric }: AgentsTabProps) {
  const period = periodOf(range);
  const from = await periodStart(period, vault);
  const chartMetric = agentMetricOf(metric);
  const [agents, days, byAgent, costliest, failures, held, status] = await Promise.all([
    getAgentConfig().list(),
    loadDailyActivity(from, new Date(), vault),
    loadAgentActivity(from, vault),
    loadCostliestPbis(from, COSTLIEST_PBIS, vault),
    loadFailureGroups(from, RECENT_FAILURES, vault),
    loadHeldTasks(vault),
    loadSystemStatus(),
  ]);
  const running = await vaultRunsInProgress(status?.runs ?? [], vault);
  const today = days.at(-1) ?? null;
  const periodLabel = periodPhrase(period);

  return (
    <>
      <div className="toolbar">
        <PeriodPicker value={period} path="/dashboard" keep={{ tab: "agents", metric: chartMetric }} />
        <span className="text-faint hint">Cost is an API-price estimate; nothing is billed on the Max plan.</span>
      </div>
      <AgentsBand days={days} today={today} periodLabel={periodLabel} held={held.length} stuck={running.filter((run) => run.stuck).length} />
      {days.some((day) => day.accountingComplete === false) && <p className="hint">Some runs have incomplete usage accounting. Cost charts show measured amounts only; total costs are unknown.</p>}
      <div className="section-label">Per day</div>
      <ActivityCharts days={days} agents={agents} metric={chartMetric} keep={{ tab: "agents", range: period }} />
      <div className="section-label">Per agent, {periodLabel}</div>
      <AgentTable agents={agents} byAgent={byAgent} today={today} budget={status?.budget ?? null} range={period} />
      <div className="grid three gap-top">
        <CostPerMinute agents={agents} byAgent={byAgent} />
        <RunsInProgress runs={running} />
        <HeldTasks tasks={held} />
      </div>
      <div className="section-label">Most expensive PBIs</div>
      <CostliestPbis pbis={costliest} />
      <div className="section-label">Last failures</div>
      <RecentFailures groups={failures} />
    </>
  );
}
