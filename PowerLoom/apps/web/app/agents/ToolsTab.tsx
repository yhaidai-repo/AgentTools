import type { ReactNode } from "react";
import { AgentDots } from "@/components/AgentDots";
import { LinkPicker } from "@/components/LinkPicker";
import { Pager } from "@/components/Pager";
import { Panel } from "@/components/Panel";
import { PeriodPicker } from "@/components/PeriodPicker";
import { BarLegend, StackedBar } from "@/components/StackedBar";
import { TimeAgo } from "@/components/TimeAgo";
import { agentsUrl } from "@/lib/agentsUrl";
import { getDb } from "@/lib/db";
import { periodStart } from "@/lib/periodStart";
import { periodOf } from "@/lib/ranges";
import { ALL_AGENTS, agentChoices, configuredResources, isUsed, latestCalls, latestToolCalls, loadDataAccess, readToolOffers, resourceUsage, toolCatalog, toolsOfAgent } from "@/lib/toolUsage";
import type { BarPart } from "@/models/BarPart";
import type { ResourceUsage } from "@/models/ResourceUsage";
import { AllToolsPanel } from "./AllToolsPanel";
import { CallRows } from "./CallRows";

const MOST_USED = 20;
const CALL_PAGE_SIZES = [50, 100];

const KIND_LABELS: Record<string, string> = { sql: "SQL", azure: "Azure", cosmos: "Cosmos DB", mongo: "Mongo", serviceBus: "Service Bus", confluence: "Confluence", localStack: "DevHub", sandbox: "Sandbox", ado: "Azure DevOps", github: "GitHub", googleDrive: "Google Drive", repo: "Repo", docs: "Docs", web: "Web", skills: "Skills", internal: "PowerLoom", other: "Other" };

const CALL_OUTCOMES: Pick<BarPart, "label" | "className">[] = [
  { label: "ok", className: "call-ok" },
  { label: "refused", className: "call-refused" },
  { label: "denied", className: "call-denied" },
  { label: "failed", className: "call-failed" },
];

type ToolsParams = { range?: string; agent?: string; page?: string; size?: string };

// The outside resources agents read through their tools (user decision 2026-10-13: every request traceable, shown
// like the Vault page's usage): most used as stacked bars, not used folded, and the calls as lines that open their
// request (user decision 2026-10-18).
export async function ToolsTab({ vault, params, tabs }: { vault: string; params: ToolsParams; tabs: ReactNode }) {
  const db = getDb();
  const range = periodOf(params.range);
  const agents = await agentChoices(db, vault);
  const agent = agents.find((choice) => choice === params.agent) ?? ALL_AGENTS;
  const calls = await loadDataAccess(db, vault, await periodStart(range, vault), agent);
  const configured = await configuredResources(db, vault);
  const usage = resourceUsage(configured, calls, await latestCalls(db, vault));
  const used = usage.filter(isUsed).sort((a, b) => b.calls - a.calls).slice(0, MOST_USED);
  const unused = usage.filter((entry) => !isUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0));
  const palette = agents.filter((choice) => choice !== ALL_AGENTS);
  const tools = toolsOfAgent(toolCatalog(await readToolOffers(db, vault), calls, await latestToolCalls(db, vault)), agent);
  const size = CALL_PAGE_SIZES.includes(Number(params.size)) ? Number(params.size) : CALL_PAGE_SIZES[0];
  const pages = Math.max(Math.ceil(calls.length / size), 1);
  const page = Math.min(Math.max(Number(params.page) || 1, 1), pages);
  const keep = { tab: "tools", range, agent };

  return (
    <>
      <div className="tab-bar">
        {tabs}
        <div className="tab-filters">
          <PeriodPicker value={range} path="/agents" keep={{ tab: "tools", agent }} />
          <LinkPicker label="Agent" value={agent} choices={agents.map((choice) => ({ key: choice, label: choice === ALL_AGENTS ? "All agents" : choice, href: agentsUrl({ ...keep, agent: choice }) }))} />
        </div>
      </div>
      <Panel title={<span>Most used <small>outside reads carry their rows; the returned data stays in the run&apos;s trace</small></span>} aside={<BarLegend parts={CALL_OUTCOMES} />} table>
        <ResourceTable rows={used} palette={palette} empty="No calls in the period." />
      </Panel>
      <details className="panel fold-panel">
        <summary><span className="fold-mark" aria-hidden="true">›</span>Not used in the period<span className="fold-count">{unused.length}</span></summary>
        <ResourceTable rows={unused} palette={palette} empty={configured.length === 0 ? "No resource is configured for this vault (Settings → Data access)." : "Every configured resource was used in the period."} />
      </details>
      <AllToolsPanel rows={tools} palette={palette} />
      <Panel title={<span>Calls <small>newest first · a line opens the request as sent</small></span>} aside={<small>{calls.length}</small>}>
        <CallRows rows={calls.slice((page - 1) * size, page * size)} palette={palette} />
        {calls.length > size && <Pager page={page} size={size} sizes={CALL_PAGE_SIZES} pages={pages} total={calls.length} noun="calls" hrefOf={(change) => agentsUrl({ ...keep, page: change.page, size: change.size ?? size })} />}
      </Panel>
    </>
  );
}

function ResourceTable({ rows, palette, empty }: { rows: ResourceUsage[]; palette: string[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="panel-body hint">{empty}</p>;
  }

  return (
    <table className="data-table vault-table tools-table">
      <thead>
        <tr><th>Resource</th><th className="col-uses">Calls</th><th className="col-agents">Agents</th><th className="col-when num">Last used</th></tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={`${row.kind}:${row.resource}`}>
            <td className="title"><span className="mono resource-name">{row.resource}</span><span className="note-path">{KIND_LABELS[row.kind] ?? row.kind} · {row.target}{row.rows > 0 ? ` · ${row.rows} rows` : ""}</span></td>
            <td className="col-uses">{row.calls > 0 ? <StackedBar parts={partsOf(row)} /> : <span className="muted">0</span>}</td>
            <td className="col-agents"><AgentDots agents={row.agents} palette={palette} /></td>
            <td className="col-when num">{row.lastUsed ? <TimeAgo date={row.lastUsed} /> : <span className="muted">never</span>}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function partsOf(row: ResourceUsage): BarPart[] {
  const counts = [row.ok, row.refused, row.denied, row.failed];

  return CALL_OUTCOMES.map((outcome, index) => ({ ...outcome, value: counts[index] }));
}
