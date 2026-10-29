import { latestVaultRunsOfAgent } from "@powerloom/core";
import Link from "next/link";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { getDb } from "@/lib/db";
import { outcomeDot } from "@/lib/runOutcomes";

const VAULT_REVIEW_AGENT = "vault-review";
const RECENT_RUNS = 3;

// The vault review agent that takes the schedule's tasks, and its last runs here, each opening its run page.
export async function VaultReviewRuns({ vault }: { vault: string }) {
  const runs = await latestVaultRunsOfAgent(getDb(), vault, VAULT_REVIEW_AGENT, RECENT_RUNS);

  return (
    <Panel title={<Link href={`/agents/${VAULT_REVIEW_AGENT}`}>Vault review agent</Link>} aside={<Link href={`/agents/${VAULT_REVIEW_AGENT}/config`}>Config</Link>}>
      {runs.length === 0 ? <p className="empty">No run yet.</p> : (
        <div className="item-rows">
          {runs.map((run) => (
            <div key={run.id} className="item-row">
              <span className={`dot ${outcomeDot(run.outcome)}`} />
              <Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link>
              <span className="item-title">{run.outcome}</span>
              <span className="item-state"><TimeAgo date={run.startedAt} /></span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
