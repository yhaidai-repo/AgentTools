import type { AgentDefinition } from "@agenttools/config";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { HeroStat } from "@/components/HeroStat";
import { RunningStrip } from "@/components/RunningStrip";
import { TimeAgo } from "@/components/TimeAgo";
import { agentColor } from "@/lib/agentColors";
import { agentsUrl } from "@/lib/agentsUrl";
import { budgetFill, isNearBudget } from "@/lib/budget";
import { cronText } from "@/lib/cronText";
import { itemPath } from "@/lib/items";
import { average, formatUsd } from "@/lib/format";
import { outcomeDot } from "@/lib/runOutcomes";
import type { AgentTotals } from "@/models/AgentTotals";
import type { RunCounts } from "@/models/RunCounts";
import { RunNowButton } from "../../AgentControls";

interface AgentHeaderProps {
  agent: AgentDefinition;
  slot: number;
  totals?: AgentTotals;
  counts?: RunCounts;
  spentTodayUsd: number;
  paused: boolean;
  /** Its runs in progress, oldest first. */
  running: { id: number; stage: string; itemId: string | null; pbiId: number | null; startedAt: Date }[];
}

// An agent's header, like the PBI page's (user decision 2026-10-18): where it sits, its colour, name and state, what it
// does, Run now, its facts, and four numbers of the last 30 days with today's spend against its daily budget. While it
// works, the PBI and task pages' running strip, one per run in progress (user, 2026-10-21).
export function AgentHeader({ agent, slot, totals, counts, spentTodayUsd, paused, running }: AgentHeaderProps) {
  return (
    <>
      <Breadcrumbs crumbs={[{ label: "Agents", href: agentsUrl({ tab: "overview" }) }, { label: agent.label }]} />
      <section className="pbi-hero" style={{ "--c": agentColor(slot) } as React.CSSProperties}>
        <div className="hero-top">
          <div className="hero-title">
            <div className="hero-id"><span className="agent-tag">{agent.id}</span><span className={agent.enabled ? "task-pill task-done" : "task-pill task-off"}>{agent.enabled ? "on" : "off"}</span></div>
            <h1 className="item-title-head"><span className="agent-dot big" />{agent.label}</h1>
            <p className="hero-description">{agent.description}</p>
          </div>
          <div className="hero-actions"><RunNowButton agentId={agent.id} disabled={paused || !agent.enabled} /></div>
        </div>
        <Facts agent={agent} counts={counts} />
        <Stats agent={agent} totals={totals} counts={counts} spentTodayUsd={spentTodayUsd} />
        {running.map((run) => <RunningStrip key={run.id} run={run} itemHref={run.itemId ? itemPath({ id: run.itemId, pbiId: run.pbiId }) : null} />)}
      </section>
    </>
  );
}

function Facts({ agent, counts }: { agent: AgentDefinition; counts?: RunCounts }) {
  return (
    <div className="hero-facts">
      <span className="fact"><b>Model</b><span className="mono">{agent.model.model} · {agent.model.effort ?? "default"} effort</span></span>
      <span className="fact"><b>Schedule</b>{agent.schedule ? cronText(agent.schedule) : "on demand"}</span>
      {counts?.lastStartedAt && <span className="fact"><b>Last run</b><span className={`dot ${outcomeDot(counts.lastOutcome)}`} /> <span className="mono"><TimeAgo date={counts.lastStartedAt} /></span></span>}
      <span className="fact-link"><Link href={agentsUrl({ tab: "runs", agent: agent.id })}>All its runs</Link></span>
    </div>
  );
}

function Stats({ agent, totals, counts, spentTodayUsd }: { agent: AgentDefinition; totals?: AgentTotals; counts?: RunCounts; spentTodayUsd: number }) {
  const cost = totals?.costUsd ?? 0;
  const failures = counts?.failures ?? 0;

  return (
    <div className="hero-stats item-stats">
      <HeroStat label="Runs · 30 days" value={String(counts?.runs ?? 0)} />
      <HeroStat label="Failed" value={String(failures)} tone={failures > 0 ? "error" : undefined} />
      <HeroStat label="Cost · 30 days" value={formatUsd(cost)} note={totals?.runs ? `${formatUsd(average(cost, totals.runs))} a run` : undefined} />
      <HeroStat label="Today" value={formatUsd(spentTodayUsd)} note={`of ${formatUsd(agent.budgets.dailyUsd)}`} tone={isNearBudget(spentTodayUsd, agent.budgets.dailyUsd) ? "warn" : undefined}>
        <div className="budget-meter"><b style={{ width: `${budgetFill(spentTodayUsd, agent.budgets.dailyUsd) * 100}%` }} /></div>
      </HeroStat>
    </div>
  );
}
