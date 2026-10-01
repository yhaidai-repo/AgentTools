import { isAgentsPaused, readAgentSettings, type AgentSettings } from "@adoa/core";
import type { UsageTotals } from "@agenttools/usage";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { LocalTime } from "@/components/LocalTime";
import { average, formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { DEFAULT_RANGE, rangeStart } from "@/lib/ranges";
import { getUsageStore } from "@/lib/usage";
import { AgentControls } from "./AgentControls";
import { RangeFilter } from "./RangeFilter";

export const dynamic = "force-dynamic";

const AGENTS = ["refinement"] as const;

export default async function AgentsPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const range = (await searchParams).range ?? DEFAULT_RANGE;
  const settings = await readAgentSettings(getDb());
  const totals = await getUsageStore().totals({ from: rangeStart(range) }, "agent");
  const byAgent = new Map(totals.map((row) => [row.group, row]));

  return (
    <>
      <h1>Agents</h1>
      <PauseState settings={settings} />
      <AgentControls isPaused={isAgentsPaused(settings)} />
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
            </tr>
          </thead>
          <tbody>
            {AGENTS.map((agent) => (
              <AgentRow key={agent} agent={agent} model={settings[agent].model} totals={byAgent.get(agent)} range={range} />
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted">Tokens = input + output + cache read + cache write. Cost is an API-price estimate; on the Max token nothing is billed.</p>
    </>
  );
}

function PauseState({ settings }: { settings: AgentSettings }) {
  if (settings.paused) {
    return <p className="result-error">All agents are paused.</p>;
  }

  const until = settings.pausedUntil ? new Date(settings.pausedUntil) : null;

  return until && until > new Date() ? <p className="result-error">Rate limited: agents paused until <LocalTime date={until} />.</p> : null;
}

function AgentRow({ agent, model, totals, range }: { agent: string; model: string; totals?: UsageTotals; range: string }) {
  const runs = totals?.runs ?? 0;
  const tokens = totals ? totals.inputTokens + totals.outputTokens + totals.cacheReadTokens + totals.cacheWriteTokens : 0;

  return (
    <tr>
      <td><Link href={`/agents/${agent}?range=${range}`}>{agent}</Link></td>
      <td>{model}</td>
      <td>{runs}</td>
      <td className={totals?.failures ? "result-error" : undefined}>{totals?.failures ?? 0}</td>
      <td>{formatTokens(tokens)} / {formatTokens(Math.round(average(tokens, runs)))}</td>
      <td>{formatUsd(totals?.costUsd ?? 0)} / {formatUsd(average(totals?.costUsd ?? 0, runs))}</td>
      <td>{formatDuration(totals?.durationMs ?? 0)} / {formatDuration(average(totals?.durationMs ?? 0, runs))}</td>
      <td><LocalTime date={totals?.lastRunAt ?? null} /> {totals?.lastOutcome ? `(${totals.lastOutcome})` : ""}</td>
    </tr>
  );
}
