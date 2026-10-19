import type { SubscriptionStatus, SubscriptionStatusWindow } from "@agenttools/usage";
import { TimeAgo } from "@/components/TimeAgo";
import { TimeUntil } from "@/components/TimeUntil";
import { formatPercent } from "@/lib/format";

const WARN_AT = 0.8;

// Each provider's subscription limits as its latest run reported them (user decision 2026-10-18): one meter per window,
// the whole account's use dim and PowerLoom's share bright, and when it resets. These are the account's, not a vault's.
export function SubscriptionMeters({ statuses }: { statuses: SubscriptionStatus[] }) {
  if (statuses.length === 0) {
    return <p className="quiet-line">Subscription usage: not reported yet. It appears after the next agent run.</p>;
  }

  return (
    <div className="subscription-meters">
      {statuses.flatMap((status) => status.windows.map((window) => <WindowMeter key={`${status.provider}-${window.window}`} provider={status.provider} asOf={status.asOf} window={window} />))}
    </div>
  );
}

function WindowMeter({ provider, asOf, window }: { provider: string; asOf: Date | null; window: SubscriptionStatusWindow }) {
  return (
    <div className={`tile sub-meter${window.utilization >= WARN_AT ? " tone-warn" : ""}`}>
      <div className="sub-top"><span className="tile-label">{window.label} limit <small>{provider}</small></span><b>{formatPercent(window.utilization)}</b></div>
      <div className="sub-bar"><span className="sub-all" style={{ width: percentOf(window.utilization) }} /><span className="sub-ours" style={{ width: percentOf(window.share) }} /></div>
      <div className="sub-bottom">
        <span>PowerLoom {formatPercent(window.share)}{asOf && <> · as of <TimeAgo date={asOf} /></>}</span>
        <span>resets <TimeUntil date={window.resetsAt} /></span>
      </div>
    </div>
  );
}

function percentOf(fraction: number): string {
  return `${Math.min(fraction, 1) * 100}%`;
}
