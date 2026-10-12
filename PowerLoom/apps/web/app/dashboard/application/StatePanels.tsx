import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { TimeAgo } from "@/components/TimeAgo";
import { formatUsd } from "@/lib/format";
import type { StateLevel, SystemStatus } from "@/lib/systemStatus";

// The status next to the scheme, one card per part of the system.
export function StatePanels({ status }: { status: SystemStatus }) {
  return (
    <div className="dashboard-cards">
      <Card title="Services">
        <Row label="Postgres" state={status.database.state} text={status.database.detail} />
        <Row label="Schedule ticker" state={status.ticker.state} text={status.ticker.lastTickAt ? <>last tick <TimeAgo date={new Date(status.ticker.lastTickAt)} /></> : "no tick yet"} />
        <Row label="agent-runner" state={status.runner.state} text={status.runner.reachable ? (status.runner.runningTask ? <>running {status.runner.runningTask}</> : "idle") : status.runner.detail ?? "unreachable"} />
        <Row label="Confluence" state={status.confluenceConfigured ? "ok" : undefined} text={status.confluenceConfigured ? "configured" : "not configured"} />
      </Card>
      <Card title="Vaults">
        {status.vaults.map((vault) => (
          <Row key={vault.name} label={vault.name} state={vault.adoEnabled && vault.adoConfigured ? "ok" : undefined} text={<>
            ADO {vault.adoEnabled && vault.adoConfigured ? "on" : vault.adoConfigured ? "off" : "not configured"}
            {vault.lastPbiSyncAt && <> · PBIs <TimeAgo date={new Date(vault.lastPbiSyncAt)} /></>}
            {vault.lastPullRequestSyncAt && <> · PRs <TimeAgo date={new Date(vault.lastPullRequestSyncAt)} /></>}
            {vault.importCheckedAt && <> · import <TimeAgo date={new Date(vault.importCheckedAt)} /></>}
          </>} />
        ))}
      </Card>
      <Card title="Messaging">
        <Row label="Waiting" text={`${status.messaging.incoming} message(s)${Object.keys(status.messaging.incomingByType).length > 0 ? `: ${Object.entries(status.messaging.incomingByType).map(([type, count]) => `${type} ${count}`).join(", ")}` : ""}`} />
        <Row label="Scheduled" text={`${status.messaging.scheduled} message(s)`} />
        <Row label="Dead letters" state={status.messaging.deadLetters > 0 ? "degraded" : "ok"} text={<>{status.messaging.deadLetters} ({status.messaging.deadLettersLast24h} in 24 h) · <Link href="/agents">Agents page</Link></>} />
      </Card>
      <Card title="Runs in progress">
        {status.runs.length === 0 && <p className="muted">None.</p>}
        {status.runs.map((run) => (
          <Row key={run.taskId} label={run.taskId} state={run.stuck ? "degraded" : "ok"} text={<>{run.agentId}{run.pbiId ? <> · <Link href={`/pbis/${run.pbiId}`}>PBI-{run.pbiId}</Link></> : null} · since <TimeAgo date={new Date(run.since)} />{run.stuck ? " · past its timeout" : ""}</>} />
        ))}
      </Card>
      <Card title="Next schedules">
        {status.schedules.slice(0, 8).map((schedule) => (
          <Row key={schedule.key} label={schedule.key} text={<><code>{schedule.cron}</code>{schedule.nextDueAt ? <> · <LocalTime date={new Date(schedule.nextDueAt)} /></> : " · never (invalid cron)"}</>} />
        ))}
        {status.schedules.length > 8 && <p className="muted">and {status.schedules.length - 8} more</p>}
      </Card>
      <Card title="Last syncs">
        {status.recentSyncs.length === 0 && <p className="muted">None yet.</p>}
        {status.recentSyncs.slice(0, 6).map((run) => (
          <Row key={run.id} label={run.stage === "pull-requests" ? "PR check" : "PBI sync"} state={run.outcome === "success" ? "ok" : run.outcome === "failed" ? "failed" : undefined} text={<><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link> · {run.outcome} · <TimeAgo date={new Date(run.startedAt)} />{run.error ? <> · <span className="result-error">{run.error}</span></> : null}</>} />
        ))}
      </Card>
      <Card title="Budget today">
        <Row label="All agents" state={budgetState(status.budget.spentTodayUsd, status.budget.dailyLimitUsd)} text={`${formatUsd(status.budget.spentTodayUsd)} of ${formatUsd(status.budget.dailyLimitUsd)}`} />
        {status.budget.agents.filter((agent) => agent.spentTodayUsd > 0 || agent.dailyLimitUsd > 0).map((agent) => (
          <Row key={agent.agentId} label={agent.agentId} state={budgetState(agent.spentTodayUsd, agent.dailyLimitUsd)} text={`${formatUsd(agent.spentTodayUsd)} of ${formatUsd(agent.dailyLimitUsd)}`} />
        ))}
      </Card>
    </div>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="card dashboard-card">
      <h3>{title}</h3>
      {children}
    </section>
  );
}

function Row({ label, state, text }: { label: string; state?: StateLevel; text: React.ReactNode }) {
  return (
    <p className="dashboard-row">
      <span className={`state-dot ${state ? `state-${state}` : "state-off"}`} />
      <strong>{label}</strong> <span className="muted">{text}</span>
    </p>
  );
}

function budgetState(spent: number, limit: number): StateLevel | undefined {
  if (limit <= 0) {
    return undefined;
  }

  return spent >= limit ? "failed" : spent >= limit * 0.8 ? "degraded" : "ok";
}
