import type { SubscriptionStatus } from "@agenttools/usage";
import { LocalTime } from "@/components/LocalTime";
import { formatPercent } from "@/lib/format";

const WARN_AT = 0.8;

// Each provider's subscription limits as its latest run reported them, and adoa's share of each window.
export function SubscriptionPanel({ statuses }: { statuses: SubscriptionStatus[] }) {
  return (
    <div className="card subscription-panel">
      {statuses.length === 0 && <p className="muted">Subscription usage: not reported yet. It appears after the next agent run.</p>}
      {statuses.map((status) => <ProviderUsage key={status.provider} status={status} />)}
    </div>
  );
}

function ProviderUsage({ status }: { status: SubscriptionStatus }) {
  return (
    <div className="chips">
      <span className="chip">{status.provider}</span>
      {status.windows.map((window) => (
        <span key={window.window} className={`chip ${window.utilization >= WARN_AT ? "result-error" : ""}`}>
          {window.label}: {formatPercent(window.utilization)} used · adoa {formatPercent(window.share)} · resets <LocalTime date={window.resetsAt} />
        </span>
      ))}
      {status.asOf && <span className="muted">as of <LocalTime date={status.asOf} /></span>}
    </div>
  );
}
