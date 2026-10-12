import type { AgentDefinition } from "@agenttools/config";
import Link from "next/link";
import { average, formatDuration, formatTokens, formatUsd } from "@/lib/format";
import type { SystemStatus } from "@/lib/systemStatus";
import type { AgentActivity } from "@/models/AgentActivity";

const WARN_AT = 0.8;

type AgentBudget = SystemStatus["budget"]["agents"][number];

interface AgentTableProps {
  agents: AgentDefinition[];
  byAgent: Map<string, AgentActivity>;
  budget: SystemStatus["budget"] | null;
  range: string;
}

// The period per agent, and today's spend against the agent's budget. Also the readable form of the charts.
export function AgentTable({ agents, byAgent, budget, range }: AgentTableProps) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Runs</th>
            <th>Failures</th>
            <th>Cost total / avg</th>
            <th>Tokens avg</th>
            <th>Duration avg</th>
            <th>Today</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, slot) => (
            <AgentRow key={agent.id} agent={agent} slot={slot} activity={byAgent.get(agent.id)} today={budget?.agents.find((entry) => entry.agentId === agent.id) ?? null} range={range} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface AgentRowProps {
  agent: AgentDefinition;
  slot: number;
  activity?: AgentActivity;
  today: AgentBudget | null;
  range: string;
}

// Averages are over finished runs: a running run has no usage yet.
function AgentRow({ agent, slot, activity, today, range }: AgentRowProps) {
  const finished = activity?.finishedRuns ?? 0;

  return (
    <tr>
      <td><span className="chart-swatch" style={{ background: `var(--series-${slot + 1})` }} />{agent.label}{agent.enabled ? "" : " (off)"}</td>
      <td><Link href={`/runs?agent=${agent.id}&range=${range}`} title="Show runs">{activity?.runs ?? 0}</Link></td>
      <td className={activity?.failures ? "result-error" : undefined}>{activity?.failures ?? 0}</td>
      <td>{formatUsd(activity?.costUsd ?? 0)} / {formatUsd(average(activity?.costUsd ?? 0, finished))}</td>
      <td>{formatTokens(Math.round(average(activity?.tokens ?? 0, finished)))}</td>
      <td>{formatDuration(average(activity?.durationMs ?? 0, finished))}</td>
      <td>{today ? <BudgetMeter spent={today.spentTodayUsd} limit={today.dailyLimitUsd} /> : "?"}</td>
    </tr>
  );
}

// The fill carries severity; the track is the same hue, lighter.
function BudgetMeter({ spent, limit }: { spent: number; limit: number }) {
  if (limit <= 0) {
    return <>{formatUsd(spent)}</>;
  }

  const share = Math.min(spent / limit, 1);
  const level = share >= 1 ? "critical" : share >= WARN_AT ? "warning" : "good";

  return (
    <span className="budget-meter">
      <span className={`meter meter-${level}`}><span style={{ width: `${Math.round(share * 100)}%` }} /></span>
      <span className={level === "good" ? undefined : "result-error"}>{formatUsd(spent)} of {formatUsd(limit)}</span>
    </span>
  );
}
