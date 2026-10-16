import type { AgentDefinition } from "@agenttools/config";
import { LocalTime } from "@/components/LocalTime";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAgentActivity, loadAgentDays, loadDailyActivity } from "@/lib/agentActivity";
import { agentColor } from "@/lib/agentColors";
import { AGENT_METRICS, agentMetricOf, agentMetricOptions } from "@/lib/agentMetrics";
import { loadRecentFailures } from "@/lib/failedRuns";
import { loadHeldTasks } from "@/lib/heldTasks";
import { loadCostliestPbis } from "@/lib/pbiCosts";
import { DEFAULT_DAY_RANGE, DAY_RANGES, RANGES, dayRangeOptions, rangeStart } from "@/lib/ranges";
import { loadSystemStatus } from "@/lib/systemStatus";
import { RangeFilter } from "../../agents/RangeFilter";
import { ActivityCharts } from "./ActivityCharts";
import { AgentChartFilters } from "./AgentChartFilters";
import { AgentTable } from "./AgentTable";
import { AgentTrend } from "./AgentTrend";
import { CostliestPbis } from "./CostliestPbis";
import { CostPerMinute } from "./CostPerMinute";
import { HeldTasks } from "./HeldTasks";
import { RecentFailures } from "./RecentFailures";
import { StuckRuns } from "./StuckRuns";
import { Summary } from "./Summary";

const RECENT_FAILURES = 8;
const COSTLIEST_PBIS = 10;
const ALL_AGENTS_COLOR = "var(--series-1)";

interface AgentsTabProps {
  range?: string;
  agent?: string;
  metric?: string;
}

// Costs, runs and failures per day and per agent over the period, today's budgets, the costliest PBIs, and what blocks
// the agents: stuck runs, held tasks, the last failures. All vaults: the budgets count every vault.
export async function AgentsTab({ range, agent, metric }: AgentsTabProps) {
  const period = range && DAY_RANGES.includes(range) ? range : DEFAULT_DAY_RANGE;
  const from = rangeStart(period);
  const now = new Date();
  const agents = await getAgentConfig().list();
  const chartSlot = agents.findIndex((definition) => definition.id === agent);
  const chartAgent = chartSlot >= 0 ? agents[chartSlot] : null;
  const chartMetric = agentMetricOf(metric);
  const chartChoice = { agent: chartAgent?.id ?? "", metric: chartMetric };
  const [days, byAgent, agentDays, costliest, failures, held, status] = await Promise.all([
    loadDailyActivity(from, now),
    loadAgentActivity(from),
    loadAgentDays(from, now, chartAgent?.id ?? null),
    loadCostliestPbis(from, COSTLIEST_PBIS),
    loadRecentFailures(from, RECENT_FAILURES),
    loadHeldTasks(),
    loadSystemStatus(),
  ]);
  const stuck = status?.runs.filter((run) => run.stuck) ?? [];

  return (
    <>
      <p className="muted">Every vault&apos;s agents, per budget day (00:00 UTC). Cost is an API-price estimate; on the Max token nothing is billed.</p>
      <RangeFilter key={period} range={period} ranges={dayRangeOptions()} keep={{ tab: "agents", ...chartChoice }} />
      <Summary days={days} budget={status?.budget ?? null} stuck={stuck.length} held={held.length} periodLabel={RANGES[period].label} />
      <ActivityCharts days={days} agents={agents} />
      <h2>Per agent</h2>
      <AgentChartFilters key={`${chartChoice.agent}-${chartMetric}`} {...chartChoice} agents={agentOptions(agents)} metrics={agentMetricOptions()} keep={{ tab: "agents", range: period }} />
      <div className="dashboard-charts">
        <AgentTrend days={agentDays} metric={AGENT_METRICS[chartMetric]} label={chartAgent?.label ?? "All agents"} color={chartAgent ? agentColor(chartSlot) : ALL_AGENTS_COLOR} />
        <CostPerMinute agents={agents} byAgent={byAgent} />
      </div>
      <AgentTable agents={agents} byAgent={byAgent} budget={status?.budget ?? null} range={period} />
      <h2>Most expensive PBIs</h2>
      <CostliestPbis pbis={costliest} />
      <div className="dashboard-cards dashboard-blockers">
        <section className="card dashboard-card">
          <h3>Stuck runs</h3>
          {status ? <StuckRuns runs={stuck} /> : <p className="result-error">PowerLoom doesn&apos;t answer: unknown.</p>}
        </section>
        <section className="card dashboard-card">
          <h3>Held tasks</h3>
          <HeldTasks tasks={held} />
        </section>
      </div>
      <h2>Last failures</h2>
      <RecentFailures runs={failures} />
      {status && <p className="muted">Budgets checked <LocalTime date={new Date(status.checkedAt)} />.</p>}
    </>
  );
}

function agentOptions(agents: AgentDefinition[]): { key: string; label: string }[] {
  return agents.map((definition) => ({ key: definition.id, label: definition.label }));
}
