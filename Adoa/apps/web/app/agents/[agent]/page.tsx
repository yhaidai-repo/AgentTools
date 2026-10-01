import { agentRun } from "@adoa/db";
import type { RunSubscriptionShare, UsageRecord } from "@agenttools/usage";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { getDb } from "@/lib/db";
import { LocalTime } from "@/components/LocalTime";
import { formatDuration, formatSharePercent, formatTokens, formatUsd } from "@/lib/format";
import { DEFAULT_RANGE, rangeOptions, rangeStart } from "@/lib/ranges";
import { loadRunShares } from "@/lib/subscription";
import { getUsageStore } from "@/lib/usage";
import { RangeFilter } from "../RangeFilter";

export const dynamic = "force-dynamic";

const MAX_RUNS = 100;

type RunRow = typeof agentRun.$inferSelect;
type Params = Promise<{ agent: string }>;
type Search = Promise<{ range?: string; outcome?: string }>;

export default async function AgentPage({ params, searchParams }: { params: Params; searchParams: Search }) {
  const { agent } = await params;
  const { range = DEFAULT_RANGE, outcome = "" } = await searchParams;
  const runs = await loadRuns(agent, rangeStart(range), outcome);
  const usage = await usageByRun(agent, rangeStart(range));
  const shares = await loadRunShares();

  return (
    <>
      <h1>Agent: {agent}</h1>
      <p><Link href="/agents">← All agents</Link> · <Link href={`/agents/${agent}/config`}>Config</Link></p>
      <RangeFilter range={range} ranges={rangeOptions()} />
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Run</th>
              <th>Started</th>
              <th>PBI</th>
              <th>Model</th>
              <th>Prompt</th>
              <th>Tokens</th>
              <th>Cost</th>
              <th>Subscription</th>
              <th>Duration</th>
              <th>Outcome</th>
            </tr>
          </thead>
          <tbody>
            {runs.map((run) => (
              <RunRowView key={run.id} run={run} usage={usage.get(String(run.id))} shares={shares.get(String(run.id)) ?? []} />
            ))}
          </tbody>
        </table>
      </div>
      {runs.length === 0 && <p className="muted">No runs in this period.</p>}
    </>
  );
}

async function loadRuns(agent: string, from: Date, outcome: string): Promise<RunRow[]> {
  const rows = await getDb()
    .select()
    .from(agentRun)
    .where(eq(agentRun.stage, agent as RunRow["stage"]))
    .orderBy(desc(agentRun.id))
    .limit(MAX_RUNS);

  return rows.filter((row) => row.startedAt >= from && (!outcome || row.outcome === outcome));
}

async function usageByRun(agent: string, from: Date): Promise<Map<string, UsageRecord>> {
  const records = await getUsageStore().records({ from, match: { agent } }, MAX_RUNS);

  return new Map(records.map((record) => [record.runId, record]));
}

function RunRowView({ run, usage, shares }: { run: RunRow; usage?: UsageRecord; shares: RunSubscriptionShare[] }) {
  const tokens = usage ? usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens : 0;

  return (
    <tr>
      <td><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link></td>
      <td><LocalTime date={run.startedAt} /></td>
      <td>{run.pbiId ? `PBI-${run.pbiId}` : "–"}</td>
      <td>{run.model ?? "–"}</td>
      <td>{run.promptVersion ?? "–"}</td>
      <td>{usage ? formatTokens(tokens) : "–"}</td>
      <td>{usage ? formatUsd(usage.costUsd) : "–"}</td>
      <td>{formatShares(shares)}</td>
      <td>{usage ? formatDuration(usage.durationMs) : "–"}</td>
      <td className={run.outcome === "success" || run.outcome === "running" ? undefined : "result-error"}>{run.outcome}</td>
    </tr>
  );
}

// The run's share of each subscription window period, e.g. "5-hour 1.4% · Weekly 0.3%" (the period's change split by cost).
function formatShares(shares: RunSubscriptionShare[]): string {
  if (shares.length === 0) {
    return "–";
  }

  return shares.map((share) => `${share.label} ${formatSharePercent(share.share)}`).join(" · ");
}
