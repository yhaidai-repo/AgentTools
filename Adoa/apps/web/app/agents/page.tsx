import { isPaused, type AgentDefinition, type AgentsGlobal } from "@agenttools/config";
import type { UsageTotals } from "@agenttools/usage";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { getAgentConfig } from "@/lib/agentConfig";
import { loadJobErrors, type JobError } from "@/lib/jobErrors";
import { average, formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { DEFAULT_RANGE, rangeStart } from "@/lib/ranges";
import { getUsageStore } from "@/lib/usage";
import { PauseControl, RunNowButton } from "./AgentControls";
import { RangeFilter } from "./RangeFilter";

export const dynamic = "force-dynamic";

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await searchParams).range ?? DEFAULT_RANGE;
  const config = getAgentConfig();
  const agents = await config.list();
  const global = await config.getGlobal();
  const totals = await getUsageStore().totals({ from: rangeStart(range) }, "agent");
  const byAgent = new Map(totals.map((row) => [row.group, row]));
  const jobErrors = await loadJobErrors(rangeStart(range));

  return (
    <>
      <h1>Agents</h1>
      <PauseState global={global} />
      <PauseControl isPaused={isPaused(global)} />
      <RangeFilter range={range} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Agent</th>
              <th>Model</th>
              <th>Runs</th>
              <th>Failures</th>
              <th>Tokens total / avg</th>
              <th>Cost total / avg</th>
              <th>Duration total / avg</th>
              <th>Last run</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {agents.map((agent) => (
              <AgentRow key={agent.id} agent={agent} totals={byAgent.get(agent.id)} range={range} isPaused={isPaused(global)} />
            ))}
          </tbody>
        </table>
      </div>
      <h2>Job errors</h2>
      <JobErrors errors={jobErrors} />
      <p className="muted">Tokens = input + output + cache read + cache write. Cost is an API-price estimate; on the Max token nothing is billed. Configure agents in Settings.</p>
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
  totals?: UsageTotals;
  range: string;
  isPaused: boolean;
}

function AgentRow({ agent, totals, range, isPaused }: AgentRowProps) {
  const runs = totals?.runs ?? 0;
  const tokens = totals ? totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens : 0;

  return (
    <tr>
      <td><Link href={`/agents/${agent.id}?range=${range}`}>{agent.label}</Link>{agent.enabled ? "" : " (off)"}</td>
      <td>{agent.model.provider}/{agent.model.model}</td>
      <td>{runs}</td>
      <td className={totals?.failures ? "result-error" : undefined}>{totals?.failures ?? 0}</td>
      <td>{formatTokens(tokens)} / {formatTokens(Math.round(average(tokens, runs)))}</td>
      <td>{formatUsd(totals?.costUsd ?? 0)} / {formatUsd(average(totals?.costUsd ?? 0, runs))}</td>
      <td>{formatDuration(totals?.durationMs ?? 0)} / {formatDuration(average(totals?.durationMs ?? 0, runs))}</td>
      <td><LocalTime date={totals?.lastRunAt ?? null} /> {totals?.lastOutcome ? `(${totals.lastOutcome})` : ""}</td>
      <td><RunNowButton agentId={agent.id} disabled={isPaused || !agent.enabled} /></td>
    </tr>
  );
}
