import Link from "next/link";
import type { ReactNode } from "react";
import { LinkPicker } from "@/components/LinkPicker";
import { Pager } from "@/components/Pager";
import { PeriodPicker } from "@/components/PeriodPicker";
import { getAgentConfig } from "@/lib/agentConfig";
import { agentsUrl } from "@/lib/agentsUrl";
import { periodStart } from "@/lib/periodStart";
import { periodOf } from "@/lib/ranges";
import { RUN_OUTCOME_GROUPS, outcomeGroupOf } from "@/lib/runOutcomes";
import { loadRunList, type RunListRow } from "@/lib/runList";
import { loadRunShares } from "@/lib/subscription";
import { RerunForm } from "../runs/RerunForm";
import { RunsTable } from "./RunsTable";

const PAGE_SIZES = [25, 50, 100];

type RunsParams = { agent?: string; range?: string; outcome?: string; page?: string; size?: string };

// Every agent's runs (user decision 2026-10-18: a tab of Agents, no longer a page): the period, the agent and the
// outcome as pills with counts, the runs in six columns, and Re-run for the selected ones' tasks.
export async function RunsTab({ vault, params, tabs }: { vault: string; params: RunsParams; tabs: ReactNode }) {
  const range = periodOf(params.range);
  const agents = (await getAgentConfig().list()).map((agent) => agent.id);
  const agent = agents.find((choice) => choice === params.agent) ?? "";
  const outcome = RUN_OUTCOME_GROUPS.find((group) => group.key === params.outcome)?.key ?? "";
  const rows = await loadRunList({ agent, range, outcome: "" }, await periodStart(range, vault), vault);
  const shown = rows.filter((row) => outcome === "" || outcomeGroupOf(row.run.outcome) === outcome);
  const size = PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : PAGE_SIZES[0];
  const pages = Math.max(Math.ceil(shown.length / size), 1);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);
  const keep = { tab: "runs", range, agent, outcome };

  return (
    <>
      <div className="tab-bar">
        {tabs}
        <div className="tab-filters">
          <PeriodPicker value={range} path="/agents" keep={{ tab: "runs", agent, outcome }} />
          <LinkPicker label="Agent" value={agent} choices={[{ key: "", label: "All agents", href: agentsUrl({ ...keep, agent: "" }) }, ...agents.map((id) => ({ key: id, label: id, href: agentsUrl({ ...keep, agent: id }) }))]} />
        </div>
      </div>
      <OutcomePills rows={rows} outcome={outcome} keep={keep} />
      {shown.length === 0 ? <p className="quiet-line">No runs match in this period.</p> : <RerunForm><RunsTable rows={shown.slice((page - 1) * size, page * size)} shares={await loadRunShares()} palette={agents} /></RerunForm>}
      {shown.length > size && <Pager page={page} size={size} sizes={PAGE_SIZES} pages={pages} total={shown.length} noun="runs" hrefOf={(change) => agentsUrl({ ...keep, page: change.page, size: change.size ?? size })} />}
    </>
  );
}

function OutcomePills({ rows, outcome, keep }: { rows: RunListRow[]; outcome: string; keep: Record<string, string> }) {
  return (
    <nav className="status-pills runs-pills" aria-label="Filter by outcome">
      <Link href={agentsUrl({ ...keep, outcome: "" })} className={outcome === "" ? "status-pill on" : "status-pill"}>All <b>{rows.length}</b></Link>
      {RUN_OUTCOME_GROUPS.map((group) => (
        <Link key={group.key} href={agentsUrl({ ...keep, outcome: group.key })} className={outcome === group.key ? "status-pill on" : "status-pill"}>
          {group.label} <b>{rows.filter((row) => outcomeGroupOf(row.run.outcome) === group.key).length}</b>
        </Link>
      ))}
    </nav>
  );
}
