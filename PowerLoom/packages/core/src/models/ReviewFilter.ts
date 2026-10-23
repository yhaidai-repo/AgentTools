import type { ReviewListStatus } from "./ReviewListStatus";

// The Reviews page's view: which reviews (active, closed, all), the page and its size, and the PR to come back to.
export interface ReviewFilter {
  status: ReviewListStatus;
  page: number;
  size: number;
  focus: number | null;
}
