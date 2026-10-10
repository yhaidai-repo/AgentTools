import type { TaskProducer } from "../models/TaskProducer";
import { VAULT_REVIEW_AGENT } from "../vaultReview";

// The vault review (user decision 2026-10-03): a task only when the schedule's vault has candidates; PowerLoom counts
// them on each tick. The schedule belongs to one vault (user decision 2026-10-06: created from that vault's Maintenance
// tab), so there is no vault parameter.
export const vaultReviewProducer: TaskProducer = {
  agentId: VAULT_REVIEW_AGENT,
  kind: "vault-review",
  prefix: "VR",
  description: "A review pass over the schedule's vault on every tick: stale or unlinked notes, dead links, open WWW/KI/OQ records.",
  maintenance: true,
  params: [],
};
