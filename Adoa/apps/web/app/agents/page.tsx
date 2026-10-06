import { isPaused, type AgentDefinition, type AgentsGlobal } from "@agenttools/config";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadJobErrors, type JobError } from "@/lib/jobErrors";
import { average, formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { DEFAULT_RANGE, rangeOptions, rangeStart } from "@/lib/ranges";
import { loadAgentTotals } from "@/lib/agentTotals";
import { currentVault } from "@/lib/currentVault";
import { NoVault } from "@/components/NoVault";
import { loadRunCounts } from "@/lib/runCounts";
import { loadSubscriptionStatus } from "@/lib/subscription";
import type { AgentTotals } from "@/models/AgentTotals";
import type { RunCounts } from "@/models/RunCounts";
import { PauseControl, RunNowButton } from "./AgentControls";
import { RangeFilter } from "./RangeFilter";
import { SubscriptionPanel } from "./SubscriptionPanel";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await rememberedParams("/agents", await searchParams)).range ?? DEFAULT_RANGE;
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Agents" />;
  }

  const config = getAgentConfig();
  const agents = await config.list();
  const global = await config.getGlobal();
  // The agents are one set for every vault; their runs, tokens and costs are the selected vault's (user decision 2026-10-06).
  const byAgent = await loadAgentTotals(rangeStart(range), vault);
  const runCounts = await loadRunCounts(rangeStart(range), vault);
  const jobErrors = await loadJobErrors(rangeStart(range));

  return (
    <>
      <h1>Agents</h1>
      <RememberFilters />
      <p className="muted">One set of agents for every vault; the runs, tokens and costs below are <code>{vault}</code>&apos;s.</p>
      <SubscriptionPanel statuses={await loadSubscriptionStatus()} />
      <PauseState global={global} />
      <PauseControl isPaused={isPaused(global)} />
      <RangeFilter key={range} range={range} ranges={rangeOptions()} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Model</th>
              <th>Runs period / total</th>
              <th>Failures</th>
              <th>Tokens total / avg</th>
              <th>Cost total / avg</th>
              <th>Duration total / avg</th>
              <th>Last run started</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} totals={byAgent.get(agent.id)} counts={runCounts.get(agent.id)} range={range} isPaused={isPaused(global)} />
            ))}
          </tbody>
        </table>
      </div>
      {agents.length === 0 && <p className="muted">No agents yet: they appear once the agent-runner has started.</p>}
      <h2>Job errors</h2>
      <JobErrors errors={jobErrors} />
      <p className="muted">Tokens = input + output + cache read + cache write. Cost is an API-price estimate; on the Max token nothing is billed. Runs opens an agent's runs, Config its settings.</p>
    </>
  );
}

function JobErrors({ errors }: { errors: JobError[] }) {
  if (errors.length === 0) {
    return <p className="muted">None in this period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Job</th>
            <th>Failed</th>
            <th>Error</th>
          </tr>
        </thead>
        <tbody>
          {errors.map((error, index) => (
            <tr key={index}>
              <td>{error.queue}</td>
              <td><LocalTime date={error.failedAt} /></td>
              <td className="title result-error">{error.message}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PauseState({ global }: { global: AgentsGlobal }) {
  if (global.paused) {
    return <p className="result-error">All agents are paused.</p>;
  }

  const until = global.pausedUntil ? new Date(global.pausedUntil) : null;

  return until && until > new Date() ? <p className="result-error">Rate limited: agents paused until <LocalTime date={until} />.</p> : null;
}

interface AgentRowProps {
  agent: AgentDefinition;
  totals?: AgentTotals;
  counts?: RunCounts;
  range: string;
  isPaused: boolean;
}

// Runs, failures and last run come from the run table (running runs included); tokens, cost and duration only exist for
// finished runs, so their averages are over finished runs.
function AgentRow({ agent, totals, counts, range, isPaused }: AgentRowProps) {
  const runs = totals?.runs ?? 0;
  const tokens = totals?.tokens ?? 0;

  return (
    <tr>
      <td>{agent.label}{agent.enabled ? "" : " (off)"}</td>
      <td>{agent.model.provider}/{agent.model.model}</td>
      <td><Link href={`/runs?agent=${agent.id}&range=${range}`} title="Show runs">{counts?.runs ?? 0}</Link> / {counts?.totalRuns ?? 0}{counts?.running ? ` (${counts.running} running)` : ""}</td>
      <td className={counts?.failures ? "result-error" : undefined}>{counts?.failures ?? 0}</td>
      <td>{formatTokens(tokens)} / {formatTokens(Math.round(average(tokens, runs)))}</td>
      <td>{formatUsd(totals?.costUsd ?? 0)} / {formatUsd(average(totals?.costUsd ?? 0, runs))}</td>
      <td>{formatDuration(totals?.durationMs ?? 0)} / {formatDuration(average(totals?.durationMs ?? 0, runs))}</td>
      <td><LocalTime date={counts?.lastStartedAt ?? null} /> {counts?.lastOutcome ? `(${counts.lastOutcome})` : ""}</td>
      <td className="actions">
        <Link href={`/agents/${agent.id}/config`} className="button secondary">Config</Link>
        <RunNowButton agentId={agent.id} disabled={isPaused || !agent.enabled} />
      </td>
    </tr>
  );
}
