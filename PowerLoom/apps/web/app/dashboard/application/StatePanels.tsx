import type { ReactNode } from "react";
import { Panel } from "@/components/Panel";
import { StatusRow } from "@/components/StatusRow";
import { TimeAgo } from "@/components/TimeAgo";
import type { StateLevel, SystemStatus } from "@/lib/systemStatus";
import { toneOfState } from "@/lib/tone";
import type { Tone } from "@/models/Tone";
import { nodeById } from "./schemeLayout";

type VaultStatus = SystemStatus["vaults"][number];

interface StatePanelsProps {
  status: SystemStatus;
  vault: string;
  /** Whether Prometheus (otel-lgtm) answered the rates query. */
  prometheusAnswers: boolean;
}

// The state of each part, one panel per kind: PowerLoom's services, its messaging, and the selected vault's
// integrations (user decision 2026-10-18: no other vault's rows).
export function StatePanels({ status, vault, prometheusAnswers }: StatePanelsProps) {
  const vaultStatus = status.vaults.find((entry) => entry.name === vault) ?? null;

  return (
    <div className="grid three">
      <ServicesPanel status={status} prometheusAnswers={prometheusAnswers} />
      <MessagingPanel messaging={status.messaging} />
      <IntegrationsPanel status={status} vault={vaultStatus} />
    </div>
  );
}

function ServicesPanel({ status, prometheusAnswers }: { status: SystemStatus; prometheusAnswers: boolean }) {
  const runner = status.runner;

  return (
    <Panel title="Services" tone={worstProblem([status.database.state, status.ticker.state, runner.state])}>
      <StatusRow name="Postgres" value={status.database.detail} tone={toneOfState(status.database.state)} />
      <StatusRow name="Schedule ticker" value={status.ticker.lastTickAt ? <TimeAgo date={status.ticker.lastTickAt} /> : "no tick yet"} tone={toneOfState(status.ticker.state)} />
      <StatusRow name="agent-runner" value={runner.reachable ? (runner.runningTask ? `running ${runner.runningTask}` : "idle") : runner.detail ?? "unreachable"} tone={toneOfState(runner.state)} />
      <StatusRow name="otel-lgtm" value={prometheusAnswers ? "answers" : "no answer"} tone={prometheusAnswers ? "good" : "warn"} />
    </Panel>
  );
}

function MessagingPanel({ messaging }: { messaging: SystemStatus["messaging"] }) {
  const deadTone: Tone = messaging.deadLetters > 0 ? "warn" : "good";

  return (
    <Panel title="Messaging" tone={deadTone === "warn" ? "warn" : "plain"}>
      <StatusRow name="Waiting" value={String(messaging.incoming)} tone="good" />
      <StatusRow name="Scheduled" value={String(messaging.scheduled)} tone="good" />
      <StatusRow name="Dead letters" value={`${messaging.deadLetters} · ${messaging.deadLettersLast24h} in 24 h`} tone={deadTone} />
    </Panel>
  );
}

// The vault's Azure DevOps sync and mail import, Confluence, then the outside systems the agents read, each once.
function IntegrationsPanel({ status, vault }: { status: SystemStatus; vault: VaultStatus | null }) {
  const outsideTones = status.outside.map((entry) => toneOfState(entry.state));

  return (
    <Panel title="Integrations" aside={<small>this vault</small>} tone={worstProblemTone(outsideTones)}>
      <AdoRows vault={vault} />
      <StatusRow name="Confluence" value={status.confluenceConfigured ? "configured" : "off"} tone={status.confluenceConfigured ? "good" : "plain"} />
      {status.outside.length > 0 && <p className="panel-subhead">Agents read</p>}
      {status.outside.map((entry) => (
        <StatusRow key={`${entry.component}-${entry.tool}`} name={nodeById(entry.component)?.label ?? entry.component} value={readValue(entry.detail)} tone={toneOfState(entry.state)} />
      ))}
    </Panel>
  );
}

// "last read 2026-10-16 12:19:13Z" reads as "read 2d ago"; any other detail stays as PowerLoom says it.
function readValue(detail: string): ReactNode {
  const match = /^last read (\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})Z$/.exec(detail);

  return match ? <>read <TimeAgo date={`${match[1]}T${match[2]}Z`} /></> : detail;
}

function AdoRows({ vault }: { vault: VaultStatus | null }) {
  if (!vault || !vault.adoConfigured) {
    return <StatusRow name="Azure DevOps" value="not configured" />;
  }

  if (!vault.adoEnabled) {
    return <StatusRow name="Azure DevOps" value="off" />;
  }

  return (
    <>
      <StatusRow name="PBI sync" value={<TimeAgo date={vault.lastPbiSyncAt} />} tone="good" />
      <StatusRow name="PR check" value={<TimeAgo date={vault.lastPullRequestSyncAt} />} tone="good" />
      {vault.importConfigured && <StatusRow name="Mail import" value={<TimeAgo date={vault.importCheckedAt} />} tone="good" />}
    </>
  );
}

// A panel breathes only for a problem; healthy panels stay plain.
function worstProblem(states: StateLevel[]): Tone {
  return worstProblemTone(states.map(toneOfState));
}

function worstProblemTone(tones: Tone[]): Tone {
  if (tones.includes("error")) {
    return "error";
  }

  return tones.includes("warn") ? "warn" : "plain";
}
