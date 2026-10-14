import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { DEFAULT_RANGE, RANGES, rangeOptions, rangeStart } from "@/lib/ranges";
import { getDb } from "@/lib/db";
import { ALL_AGENTS, agentChoices, configuredResources, isUsed, latestCalls, loadDataAccess, resourceUsage, type DataAccessRow } from "@/lib/toolUsage";
import type { ResourceUsage } from "@/models/ResourceUsage";
import { RangeFilter } from "./RangeFilter";

const MOST_USED = 20;
// The period's calls can be many; the table shows the latest ones until asked for all (as the Vault page's unused notes).
const CALLS = 50;
const SHOW_ALL = "all";

const KIND_LABELS: Record<string, string> = { sql: "SQL", azure: "Azure", cosmos: "Cosmos DB", mongo: "Mongo", confluence: "Confluence", localStack: "DevHub", ado: "Azure DevOps", repo: "Repo", docs: "Docs", web: "Web", skills: "Skills", internal: "PowerLoom", other: "Other" };

type ToolsParams = { range?: string; agent?: string; calls?: string };

// The outside resources agents read through their tools (user decision 2026-10-13: every request traceable, shown
// like the Vault page's usage): most used, not used in the period, and the calls themselves.
export async function ToolsTab({ vault, params }: { vault: string; params: ToolsParams }) {
  const db = getDb();
  const range = params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE;
  const agents = await agentChoices(db, vault);
  const agent = agents.find((choice) => choice === params.agent) ?? ALL_AGENTS;
  const rows = await loadDataAccess(db, vault, rangeStart(range), agent);
  const configured = await configuredResources(db, vault);
  const usage = resourceUsage(configured, rows, await latestCalls(db, vault));
  const used = usage.filter(isUsed).sort((a, b) => b.calls - a.calls).slice(0, MOST_USED);
  const unused = usage.filter((entry) => !isUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0));
  const showAllCalls = params.calls === SHOW_ALL;
  const keep = { tab: "tools" };

  return (
    <>
      <p className="muted">Vault <code>{vault}</code>: every tool call an agent made, with the request as sent and its outcome; outside reads (SQL, Azure, Confluence) carry the resource and the rows, the rest is logged from the run&apos;s events, so a new tool is tracked without any wiring. The returned data stays in the run&apos;s trace.</p>
      <div className="toolbar">
        <RangeFilter key={`range-${range}-${agent}`} range={range} ranges={rangeOptions()} keep={{ ...keep, agent }} />
        <RangeFilter key={`agent-${range}-${agent}`} range={agent} ranges={agents.map((choice) => ({ key: choice, label: choice === ALL_AGENTS ? "All agents" : choice }))} keep={{ ...keep, range }} name="agent" label="Agent" />
      </div>
      <h2>Most used ({used.length})</h2>
      <UsageTable rows={used} empty="No calls in the period." />
      <h2>Not used in the period ({unused.length})</h2>
      <UsageTable rows={unused} empty={configured.length === 0 ? "No resource is configured for this vault (Settings → Read SQL, Read Azure)." : "Every configured resource was used in the period."} />
      <h2>Calls ({rows.length})</h2>
      <CallsTable rows={showAllCalls ? rows : rows.slice(0, CALLS)} />
      {!showAllCalls && rows.length > CALLS && (
        <p className="muted">
          The latest {CALLS} of {rows.length}. <Link href={`/agents?${new URLSearchParams({ tab: "tools", range, agent, calls: SHOW_ALL })}`}>Show all</Link>
        </p>
      )}
    </>
  );
}

function UsageTable({ rows, empty }: { rows: ResourceUsage[]; empty: string }) {
  if (rows.length === 0) {
    return <p className="muted">{empty}</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Kind</th><th>Resource</th><th>Target</th><th>Calls</th><th>OK</th><th>Refused</th><th>Denied</th><th>Failed</th><th>Rows</th><th>Agents</th><th>Last used</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.kind}:${row.resource}`}>
              <td>{KIND_LABELS[row.kind] ?? row.kind}</td>
              <td>{row.resource}</td>
              <td><code>{row.target}</code></td>
              <td>{row.calls}</td>
              <td>{row.ok}</td>
              <td className={row.refused > 0 ? "result-error" : undefined}>{row.refused}</td>
              <td className={row.denied > 0 ? "result-error" : undefined}>{row.denied}</td>
              <td>{row.failed}</td>
              <td>{row.rows}</td>
              <td>{row.agents.join(", ") || "–"}</td>
              <td>{row.lastUsed ? <LocalTime date={row.lastUsed} /> : "never"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CallsTable({ rows }: { rows: DataAccessRow[] }) {
  if (rows.length === 0) {
    return <p className="muted">No calls in the period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>When</th><th>Agent</th><th>Tool</th><th>Resource</th><th>Request</th><th>Outcome</th><th>Rows</th><th>Time</th><th>Run</th></tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td><LocalTime date={row.startedAt} /></td>
              <td>{row.agentId}</td>
              <td>{row.tool}</td>
              <td>{row.resource}</td>
              <td><code>{row.request}</code></td>
              <td className={row.outcome === "ok" ? undefined : "result-error"}>{row.outcome}{row.reason ? `: ${row.reason}` : ""}</td>
              <td>{row.rows ?? "–"}{row.truncated ? " (cut)" : ""}</td>
              <td>{row.durationMs} ms</td>
              <td><Link href={`/runs?run=${row.runId}`}>RUN-{row.runId}</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
