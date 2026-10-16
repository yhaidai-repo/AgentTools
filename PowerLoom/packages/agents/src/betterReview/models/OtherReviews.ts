import type { AdoPrThread } from "@powerloom/ado";

// The PR's comment threads in Azure DevOps, people's only, or why they couldn't be read.
export type OtherReviews = { threads: AdoPrThread[] } | { unavailable: string };
