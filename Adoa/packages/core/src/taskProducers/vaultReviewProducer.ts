import { listVaults, scanVault, vaultsDir, vaultsExclude } from "@adoa/vault";
import type { Outcome } from "../models/Outcome";
import type { ProducedTask } from "../models/ProducedTask";
import type { ProducerContext } from "../models/ProducerContext";
import type { TaskProducer } from "../models/TaskProducer";
import { VAULT_REVIEW_AGENT, candidateCount, reviewCandidates, vaultReviewOptions } from "../vaultReview";

const VAULTS_PARAM = "vaults";

// The vault review (user decision 2026-10-03): a task only when the schedule's vaults have candidates; the vaults go
// into the task, so the agent reviews exactly those.
export const vaultReviewProducer: TaskProducer = {
  agentId: VAULT_REVIEW_AGENT,
  kind: "vault-review",
  prefix: "VR",
  description: "A review pass over the chosen vaults, created only when they have stale or unlinked notes or dead links.",
  params: [
    {
      key: VAULTS_PARAM,
      label: "Vaults",
      description: "Vault folders under the vaults root to review.",
      kind: "choices",
      choices: availableVaults,
      defaultValue: ["work-projects"],
    },
  ],
  produce,
};

async function produce(context: ProducerContext, params: Record<string, unknown>): Promise<Outcome<ProducedTask>> {
  const available = await availableVaults();
  const vaults = stringList(params[VAULTS_PARAM]).filter((vault) => available.includes(vault));

  if (vaults.length === 0) {
    return { ok: false, error: "none of the schedule's vaults is available" };
  }

  const counts = await countCandidates(context, vaults);
  const total = Object.values(counts).reduce((sum, count) => sum + count, 0);

  return { ok: true, value: reviewTask(counts, total) };
}

// A vault gone or excluded since the schedule was saved is skipped.
async function availableVaults(): Promise<string[]> {
  const root = vaultsDir();

  return root ? listVaults(root, vaultsExclude()) : [];
}

async function countCandidates(context: ProducerContext, vaults: string[]): Promise<Record<string, number>> {
  const options = vaultReviewOptions(context.agentOptions);
  const counts: Record<string, number> = {};

  for (const vault of vaults) {
    counts[vault] = candidateCount(await reviewCandidates(context.db, await scanVault(vaultsDir()!, vault), options));
  }

  return counts;
}

function reviewTask(counts: Record<string, number>, total: number): ProducedTask {
  const lines = Object.entries(counts).map(([vault, count]) => `- ${vault}: ${count}`);

  return {
    title: `Review the vaults: ${total} candidate(s)`,
    body: ["Candidates (stale or unlinked notes, dead links) when the task was created:", ...lines].join("\n"),
    data: { vaults: Object.keys(counts), counts },
    notNeeded: total === 0 ? `nothing to review in ${Object.keys(counts).join(", ")}` : null,
  };
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}
