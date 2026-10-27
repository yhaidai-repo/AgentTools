import type { AgentDefinition } from "@agenttools/config";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { agentColor } from "@/lib/agentColors";
import { budgetLevel } from "@/lib/budget";
import { average, formatDuration, formatTokens, formatUsd } from "@/lib/format";
import type { SystemStatus } from "@/lib/systemStatus";
import type { AgentActivity } from "@/models/AgentActivity";
import type { DayActivity } from "@/models/DayActivity";

const METER_CLASSES = { good: "meter", warning: "meter near", critical: "meter over" } as const;

interface AgentTableProps {
  agents: AgentDefinition[];
  byAgent: Map<string, AgentActivity>;
  /** The vault's budget day running now. */
  today: DayActivity | null;
  /** The daily limits, from PowerLoom. */
  budget: SystemStatus["budget"] | null;
  range: string;
}

// The period per agent, and the vault's spend today against the agent's daily limit (user, 2026-10-18: the progress
// bar stays). Also the readable form of the charts.
export function AgentTable({ agents, byAgent, today, budget, range }: AgentTableProps) {
  return (
    <Panel table>
      <table className="data-table">
        <thead>
          <tr>
            <th>Agent</th>
            <th className="num">Runs</th>
            <th className="num">Failed</th>
            <th className="num">Cost</th>
            <th className="num">Per run</th>
            <th className="num">Tokens / run</th>
            <th className="num">Time / run</th>
            <th>Today / daily limit</th>
          </tr>
        </thead>
        <tbody>
          {agents.map((agent, slot) => (
            <AgentRow key={agent.id} agent={agent} slot={slot} activity={byAgent.get(agent.id)} spentToday={today?.accountingComplete === false ? null : today?.costByAgent[agent.id] ?? 0} limit={limitOf(budget, agent.id)} range={range} />
          ))}
        </tbody>
      </table>
    </Panel>
  );
}

interface AgentRowProps {
  agent: AgentDefinition;
  slot: number;
  activity?: AgentActivity;
  spentToday: number | null;
  limit: number | null;
  range: string;
}

// Averages are over finished runs: a running run has no usage yet.
function AgentRow({ agent, slot, activity, spentToday, limit, range }: AgentRowProps) {
  const finished = activity?.finishedRuns ?? 0;
  const failures = activity?.failures ?? 0;

  return (
    <tr className={agent.enabled ? undefined : "off"}>
      <td><span className="swatch" style={{ background: agentColor(slot) }} />{agent.label}{!agent.enabled && <span className="off-tag">off</span>}</td>
      <td className="num"><Link href={`/agents?tab=runs&agent=${agent.id}&range=${range}`} title="Show runs">{activity?.runs ?? 0}</Link></td>
      <td className={`num${failures > 0 ? " text-error" : ""}`}>{failures}</td>
      <td className="num">{formatUsd(activity?.costUsd ?? 0, activity?.accountingComplete)}</td>
      <td className="num">{formatUsd(average(activity?.costUsd ?? 0, finished), activity?.accountingComplete)}</td>
      <td className="num">{formatTokens(Math.round(average(activity?.tokens ?? 0, finished)))}</td>
      <td className="num">{formatDuration(average(activity?.durationMs ?? 0, finished))}</td>
      <td><BudgetMeter spent={spentToday} limit={limit} /></td>
    </tr>
  );
}

// The bar turns amber from 80 % of the limit and rose at the limit (BUDGET_WARN_AT).
function BudgetMeter({ spent, limit }: { spent: number | null; limit: number | null }) {
  const level = limit === null ? null : budgetLevel(spent, limit);

  if (spent === null || level === null || limit === null) {
    return <span className="num">{formatUsd(spent)}</span>;
  }

  return (
    <span className="budget">
      <span className={METER_CLASSES[level]}><span style={{ width: `${Math.round(Math.min(spent / limit, 1) * 100)}%` }} /></span>
      <span className="amount">{formatUsd(spent)} / {formatUsd(limit)}</span>
    </span>
  );
}

function limitOf(budget: SystemStatus["budget"] | null, agentId: string): number | null {
  return budget?.agents.find((entry) => entry.agentId === agentId)?.dailyLimitUsd ?? null;
}
