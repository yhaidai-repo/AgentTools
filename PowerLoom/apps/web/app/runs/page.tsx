import { isFailedOutcome } from "@powerloom/core";
import type { RunSubscriptionShare } from "@agenttools/usage";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { RememberFilters } from "@/components/RememberFilters";
import { rememberedParams } from "@/lib/rememberedFilters";
import { getAgentConfig } from "@/lib/agentConfig";
import { formatDuration, formatSharePercent, formatTokens, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import { DEFAULT_RANGE, rangeOptions, rangeStart } from "@/lib/ranges";
import { NoVault } from "@/components/NoVault";
import { currentVault } from "@/lib/currentVault";
import { loadRunList, type RunListRow } from "@/lib/runList";
import { loadRunShares } from "@/lib/subscription";
import type { RunListFilter } from "@/models/RunListFilter";
import { RunFilters } from "./RunFilters";
import { RerunForm } from "./RerunForm";
import { RunSelect } from "./RunSelect";

export const dynamic = "force-dynamic";

type Search = Promise<{ agent?: string; range?: string; outcome?: string }>;

// Every agent's runs, filtered by agent and period; the tasks of selected runs can be re-run together.
export default async function RunsPage({ searchParams }: { searchParams: Search }) {
  const params = await rememberedParams("/runs", await searchParams);
  const filter: RunListFilter = { agent: params.agent ?? "", range: params.range ?? DEFAULT_RANGE, outcome: params.outcome ?? "" };
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Runs" />;
  }

  const rows = await loadRunList(filter, rangeStart(filter.range), vault);
  const shares = await loadRunShares();
  const agents = (await getAgentConfig().list()).map((agent) => agent.id);

  return (
    <>
      <h1>Runs</h1>
      <RememberFilters />
      {filter.agent && <p><Link href={`/agents/${filter.agent}/config`}>{filter.agent} config</Link></p>}
      <RunFilters key={JSON.stringify(filter)} filter={filter} agents={agents} ranges={rangeOptions()} />
      {rows.length === 0 ? <p className="muted">No runs in this period.</p> : <RerunForm><RunTable rows={rows} shares={shares} /></RerunForm>}
    </>
  );
}

function RunTable({ rows, shares }: { rows: RunListRow[]; shares: Map<string, RunSubscriptionShare[]> }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th /><th>Run</th><th>Agent</th><th>Started</th><th>Task</th><th>Model</th><th>Prompt</th><th>Tokens</th><th>Cost</th>
            <th>Subscription</th><th>Duration</th><th>Outcome</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => <RunRowView key={row.run.id} row={row} shares={shares.get(String(row.run.id)) ?? []} />)}
        </tbody>
      </table>
    </div>
  );
}

function RunRowView({ row, shares }: { row: RunListRow; shares: RunSubscriptionShare[] }) {
  const { run, task, usage } = row;
  const tokens = usage ? usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens : 0;

  return (
    <tr>
      <td><RunSelect run={run} task={task} /></td>
      <td><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link>{run.continuesRunId && <span className="muted" title={`Continues RUN-${run.continuesRunId}'s conversation`}> ↻</span>}</td>
      <td>{run.stage}</td>
      <td><LocalTime date={run.startedAt} /></td>
      <td>{task ? <Link href={itemPath(task)}>{task.id}</Link> : "–"}{run.pbiId ? <> · <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link></> : null}</td>
      <td>{run.model ?? "–"}</td>
      <td>{run.promptVersion ?? "–"}</td>
      <td>{usage ? formatTokens(tokens) : "–"}</td>
      <td>{usage ? formatUsd(usage.costUsd) : "–"}</td>
      <td>{formatShares(shares)}</td>
      <td>{usage ? formatDuration(usage.durationMs) : "–"}</td>
      <td className={isFailedOutcome(run.outcome) ? "result-error" : undefined}>{run.outcome}</td>
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
