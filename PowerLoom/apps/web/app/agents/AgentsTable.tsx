import type { AgentDefinition } from "@agenttools/config";
import type { CurrentWindowShare } from "@agenttools/usage";
import Link from "next/link";
import { TimeAgo } from "@/components/TimeAgo";
import { agentColor } from "@/lib/agentColors";
import { agentsUrl } from "@/lib/agentsUrl";
import { cronText } from "@/lib/cronText";
import { average, formatDuration, formatSharePercent, formatTokens, formatUsd } from "@/lib/format";
import { outcomeDot } from "@/lib/runOutcomes";
import type { AgentTotals } from "@/models/AgentTotals";
import type { RunCounts } from "@/models/RunCounts";
import { RunNowButton } from "./AgentControls";
import { RunNowResults } from "./RunNowResults";

interface AgentsTableProps {
  agents: AgentDefinition[];
  totals: Map<string, AgentTotals>;
  counts: Map<string, RunCounts>;
  limits: Map<string, CurrentWindowShare[]>;
  range: string;
  paused: boolean;
}

// One row per agent in four columns that fit (user decision 2026-10-18): the agent in its colour with its model, tokens,
// time and schedule under it; its runs; its cost with its use of the subscription limits; its last run. The row opens its config; Run now shows on
// hover. Agents that are on come first, then by cost.
export function AgentsTable({ agents, totals, counts, limits, range, paused }: AgentsTableProps) {
  if (agents.length === 0) {
    return <p className="quiet-line">No agents yet: they appear once the agent-runner has started.</p>;
  }

  const slots = new Map(agents.map((agent, slot) => [agent.id, slot]));
  const sorted = [...agents].sort((a, b) => Number(b.enabled) - Number(a.enabled) || costOf(totals, b) - costOf(totals, a));

  return (
    <div className="panel">
      <RunNowResults>
        <table className="data-table vault-table agents-table">
          <thead>
            <tr><th>Agent</th><th className="col-runs num">Runs</th><th className="col-cost num">Cost</th><th className="col-last num">Last run</th><th className="col-act" aria-label="Actions" /></tr>
          </thead>
          <tbody>
            {sorted.map((agent) => <AgentRow key={agent.id} agent={agent} color={agentColor(slots.get(agent.id) ?? 0)} totals={totals.get(agent.id)} counts={counts.get(agent.id)} limits={limits.get(agent.id) ?? []} range={range} paused={paused} />)}
          </tbody>
        </table>
      </RunNowResults>
      <p className="panel-body hint">Tokens = input + output + cache read + cache write. Cost is an API-price estimate; on the Max token nothing is billed.</p>
    </div>
  );
}

interface AgentRowProps {
  agent: AgentDefinition;
  color: string;
  totals?: AgentTotals;
  counts?: RunCounts;
  limits: CurrentWindowShare[];
  range: string;
  paused: boolean;
}

// Runs, failures and the last run come from the run table (running runs included); tokens, cost and duration only exist
// for finished runs, so their averages are over finished runs.
function AgentRow({ agent, color, totals, counts, limits, range, paused }: AgentRowProps) {
  const runs = totals?.runs ?? 0;
  const cost = totals?.costUsd ?? 0;

  return (
    <tr className={agent.enabled ? undefined : "settled"} style={{ "--c": color } as React.CSSProperties}>
      <td className="title">
        <Link href={`/agents/${agent.id}/config`} className="agent-name"><span className="agent-dot" />{agent.label}{!agent.enabled && <span className="off-tag">off</span>}</Link>
        <div className="row-facts">
          <span>{agent.model.model}</span>
          {runs > 0 && <span>{formatTokens(totals?.tokens ?? 0)} tokens · {formatTokens(Math.round(average(totals?.tokens ?? 0, runs)))} a run</span>}
          {runs > 0 && <span>{formatDuration(totals?.durationMs ?? 0)} · {formatDuration(average(totals?.durationMs ?? 0, runs))} a run</span>}
          {agent.schedule && <span>{cronText(agent.schedule)}</span>}
        </div>
      </td>
      <td className="col-runs num">
        <Link href={agentsUrl({ tab: "runs", agent: agent.id, range })} title={`${counts?.totalRuns ?? 0} in all`}>{counts?.runs ?? 0}</Link>
        <RunsNote counts={counts} />
      </td>
      <td className="col-cost num">
        {formatUsd(cost)}
        {runs > 0 && <small className="cost-per-run">{formatUsd(average(cost, runs))} a run</small>}
        {limits.map((limit) => <LimitUse key={`${limit.provider}-${limit.window}`} limit={limit} />)}
      </td>
      <td className="col-last num"><LastRun counts={counts} /></td>
      <td className="col-act"><span className="row-action"><RunNowButton agentId={agent.id} disabled={paused || !agent.enabled} /></span></td>
    </tr>
  );
}

// The agent's use of one subscription limit since it last reset, against the whole limit (user request 2026-10-22): the
// same split as the limit meters' PowerLoom share, so it is back at 0 after a reset until the agent runs again.
function LimitUse({ limit }: { limit: CurrentWindowShare }) {
  return (
    <div className="limit-use" title={`${limit.label} limit: this agent used ${formatSharePercent(limit.share)} of it since it last reset`}>
      <small>{limit.label} {formatSharePercent(limit.share)}</small>
      <div className="cost-bar"><b style={{ width: `${Math.min(limit.share, 1) * 100}%` }} /></div>
    </div>
  );
}

function RunsNote({ counts }: { counts?: RunCounts }) {
  if (counts?.running) {
    return <small className="runs-note running">{counts.running} running</small>;
  }

  return <small className={counts?.failures ? "runs-note failed" : "runs-note"}>{counts?.failures ?? 0} failed</small>;
}

function LastRun({ counts }: { counts?: RunCounts }) {
  if (!counts?.lastStartedAt) {
    return <span className="muted">–</span>;
  }

  return <span className="last-run" title={counts.lastOutcome ?? undefined}><span className={`dot ${outcomeDot(counts.lastOutcome)}`} /><TimeAgo date={counts.lastStartedAt} /></span>;
}

function costOf(totals: Map<string, AgentTotals>, agent: AgentDefinition): number {
  return totals.get(agent.id)?.costUsd ?? 0;
}
