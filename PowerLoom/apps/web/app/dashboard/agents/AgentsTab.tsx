import { LocalTime } from "@/components/LocalTime";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadAgentActivity, loadDailyActivity } from "@/lib/agentActivity";
import { loadRecentFailures } from "@/lib/failedRuns";
import { loadHeldTasks } from "@/lib/heldTasks";
import { DEFAULT_DAY_RANGE, DAY_RANGES, RANGES, dayRangeOptions, rangeStart } from "@/lib/ranges";
import { loadSystemStatus } from "@/lib/systemStatus";
import { RangeFilter } from "../../agents/RangeFilter";
import { ActivityCharts } from "./ActivityCharts";
import { AgentTable } from "./AgentTable";
import { HeldTasks } from "./HeldTasks";
import { RecentFailures } from "./RecentFailures";
import { StuckRuns } from "./StuckRuns";
import { Summary } from "./Summary";

const RECENT_FAILURES = 8;

// Costs, runs and failures per day and per agent over the period, today's budgets, and what blocks the agents: stuck
// runs, held tasks, the last failures. All vaults: the budgets count every vault.
export async function AgentsTab({ range }: { range?: string }) {
  const period = range && DAY_RANGES.includes(range) ? range : DEFAULT_DAY_RANGE;
  const from = rangeStart(period);
  const now = new Date();
  const agents = await getAgentConfig().list();
  const [days, byAgent, failures, held, status] = await Promise.all([loadDailyActivity(from, now), loadAgentActivity(from), loadRecentFailures(from, RECENT_FAILURES), loadHeldTasks(), loadSystemStatus()]);
  const stuck = status?.runs.filter((run) => run.stuck) ?? [];

  return (
    <>
      <p className="muted">Every vault&apos;s agents, per budget day (00:00 UTC). Cost is an API-price estimate; on the Max token nothing is billed.</p>
      <RangeFilter key={period} range={period} ranges={dayRangeOptions()} keep={{ tab: "agents" }} />
      <Summary days={days} budget={status?.budget ?? null} stuck={stuck.length} held={held.length} periodLabel={RANGES[period].label} />
      <ActivityCharts days={days} agents={agents} />
      <h2>Per agent</h2>
      <AgentTable agents={agents} byAgent={byAgent} budget={status?.budget ?? null} range={period} />
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
