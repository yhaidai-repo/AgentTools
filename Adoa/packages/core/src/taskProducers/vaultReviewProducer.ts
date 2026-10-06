import { scanVault, vaultsDir } from "@adoa/vault";
import type { Outcome } from "../models/Outcome";
import type { ProducedTask } from "../models/ProducedTask";
import type { ProducerContext } from "../models/ProducerContext";
import type { TaskProducer } from "../models/TaskProducer";
import { VAULT_REVIEW_AGENT, candidateCount, reviewCandidates, vaultReviewOptions } from "../vaultReview";

// The vault review (user decision 2026-10-03): a task only when the schedule's vault has candidates. The schedule belongs
// to one vault (user decision 2026-10-06: created from that vault's Maintenance tab), so there is no vault parameter.
export const vaultReviewProducer: TaskProducer = {
  agentId: VAULT_REVIEW_AGENT,
  kind: "vault-review",
  prefix: "VR",
  description: "A review pass over the schedule's vault on every tick: stale or unlinked notes, dead links, open WWW/KI/OQ records.",
  maintenance: true,
  params: [],
  produce,
};

async function produce(context: ProducerContext): Promise<Outcome<ProducedTask>> {
  const root = vaultsDir();

  if (!root) {
    return { ok: false, error: "the vaults root isn't mounted (VAULTS_DIR)" };
  }

  const options = vaultReviewOptions(context.agentOptions);
  const count = candidateCount(await reviewCandidates(context.db, await scanVault(root, context.vault), options));

  return { ok: true, value: reviewTask(context.vault, count) };
}

// The task names its vault in `data.vaults`, as the agent's executor reads it.
function reviewTask(vault: string, count: number): ProducedTask {
  return {
    title: `Review the vault ${vault}: ${count} candidate(s)`,
    body: `Candidates (stale or unlinked notes, dead links, open records) when the task was created: ${count}.`,
    data: { vaults: [vault], counts: { [vault]: count } },
    notNeeded: count === 0 ? `nothing to review in ${vault}` : null,
  };
}
