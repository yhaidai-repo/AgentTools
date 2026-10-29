import { Panel } from "@/components/Panel";
import type { ObservabilityState } from "@/models/ObservabilityState";

export function TelemetryPanel({ state, url }: { state: ObservabilityState; url: string | null }) {
  return (
    <Panel title="Logs, metrics and traces" tone={state === "no answer" ? "warn" : "plain"}>
      {state === "off" ? <p className="text-faint">Telemetry is switched off.</p> : <>
        {state === "no answer" && <p className="text-warn">Aspire Dashboard could not be reached.</p>}
        {url && <p><a href={url} target="_blank" rel="noreferrer">Open Aspire Dashboard</a></p>}
        <p className="text-faint">Recent telemetry is retained across restarts, up to the configured storage limits.</p>
      </>}
    </Panel>
  );
}
