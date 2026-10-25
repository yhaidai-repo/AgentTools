import type { AddedLocalReview } from "./AddedLocalReview";
import type { AddedReview } from "./AddedReview";
import type { NewLocalReview } from "./NewLocalReview";
import type { NewReview } from "./NewReview";
import type { Outcome } from "./Outcome";

// The review changes the web made through the API directly before stage 3 of the powerloom-mcp design.
export interface ReviewWorkPort {
  addReview(review: NewReview): Promise<Outcome<AddedReview>>;
  addLocalReview(review: NewLocalReview): Promise<Outcome<AddedLocalReview>>;
  // A review task for the PR's current commit; the PR's title.
  queueReview(prId: number): Promise<Outcome<string>>;
  // Closed in PowerLoom only (ADO isn't told); Rerun reopens it. The PR's title.
  closeReview(prId: number, reason: string | null): Promise<Outcome<string>>;
  // Queues the vault's pull request check (Azure DevOps).
  syncPullRequests(vault: string): Promise<Outcome<void>>;
  // Queues the vault's GitHub pull request check.
  syncGitHubPullRequests(vault: string): Promise<Outcome<void>>;
}
