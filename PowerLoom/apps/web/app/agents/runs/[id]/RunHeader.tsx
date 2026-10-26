import type { UsageRecord } from "@agenttools/usage";
import type { agentRun, localItem } from "@powerloom/db";
import Link from "next/link";
import { AgentTag } from "@/components/AgentTag";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { HeroStat } from "@/components/HeroStat";
import { TimeAgo } from "@/components/TimeAgo";
import { agentsUrl } from "@/lib/agentsUrl";
import { formatDuration, formatTokens, formatUsd } from "@/lib/format";
import { itemPath } from "@/lib/items";
import { outcomeDot } from "@/lib/runOutcomes";
import { RunRerun } from "@/app/runs/RunRerun";
import { ConversationFacts } from "./ConversationFacts";

type RunRow = typeof agentRun.$inferSelect;
type TaskRow = typeof localItem.$inferSelect;

// A run's header, like the PBI page's (user decision 2026-10-18): where it sits, its agent and outcome, the task it
// worked on, Download (the run as one file) and Re-run (Stop while it runs), its facts and four numbers.
export function RunHeader({ run, task, usage, palette }: { run: RunRow; task: TaskRow | null; usage?: UsageRecord; palette: string[] }) {
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Agents", href: agentsUrl({ tab: "overview" }) }, { label: "Runs", href: agentsUrl({ tab: "runs", agent: run.stage }) }, { label: `RUN-${run.id}` }]} />
      <section className="pbi-hero">
        <div className="hero-top">
          <div className="hero-title">
            <div className="hero-id"><span className="id">RUN-{run.id}</span><AgentTag agent={run.stage} palette={palette} /><span className="run-outcome"><span className={`dot ${outcomeDot(run.outcome)}`} />{run.outcome}</span></div>
            <h1 className="item-title-head">{task?.title ?? `${run.stage} run`}</h1>
          </div>
          <div className="hero-actions"><a className="button secondary" href={`/agents/runs/${run.id}/export`} download title="The whole run as one JSON file: input, outcome, task, usage, the uncut trace and its logs">Download</a><RunRerun task={task} isRunning={run.outcome === "running"} /></div>
        </div>
        <div className="hero-facts">
          {task && <span className="fact"><b>Task</b><Link href={itemPath(task)}>{task.id}</Link></span>}
          {run.pbiId && <span className="fact"><b>PBI</b><Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link></span>}
          <span className="fact"><b>Model</b><span className="mono">{run.model ?? "–"}</span></span>
          <span className="fact"><b>Prompt</b><span className="mono">{run.promptVersion ?? "–"}</span></span>
          <span className="fact"><b>Started</b><span className="mono"><TimeAgo date={run.startedAt} /></span></span>
          <ConversationFacts run={run} />
        </div>
        <RunStats usage={usage} />
      </section>
    </>
  );
}

// Tokens and cost exist once the run ended (its usage record is written then).
function RunStats({ usage }: { usage?: UsageRecord }) {
  if (!usage) {
    return null;
  }

  const tokens = usage.inputTokens + usage.outputTokens + usage.cacheReadTokens + usage.cacheWriteTokens;

  return (
    <div className="hero-stats item-stats">
      <HeroStat label="Took" value={formatDuration(usage.durationMs)} />
      <HeroStat label="Turns" value={String(usage.turns)} />
      <HeroStat label="Tokens" value={formatTokens(tokens)} note={`in ${formatTokens(usage.inputTokens)} · out ${formatTokens(usage.outputTokens)} · cache ${formatTokens(usage.cacheReadTokens)} / ${formatTokens(usage.cacheWriteTokens)}`} />
      <HeroStat label="Cost" value={formatUsd(usage.costUsd)} note={usage.providerCostUsd !== null ? `provider ${formatUsd(usage.providerCostUsd)}` : undefined} />
    </div>
  );
}
