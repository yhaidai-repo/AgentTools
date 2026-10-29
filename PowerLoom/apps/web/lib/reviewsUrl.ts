import type { ReviewFilter } from "@/models/ReviewFilter";

// The Reviews page's address for a view: the status, the search, the page and its size, and the PR to come back to.
export function reviewsUrl(filter: Partial<ReviewFilter>): string {
  const query = new URLSearchParams();

  query.set("status", filter.status ?? "active");
  addNumber(query, "page", filter.page && filter.page > 1 ? filter.page : null);
  addNumber(query, "size", filter.size ?? null);
  addNumber(query, "focus", filter.focus ?? null);

  if (filter.search) {
    query.set("q", filter.search);
  }

  return `/reviews?${query.toString()}`;
}

function addNumber(query: URLSearchParams, name: string, value: number | null): void {
  if (value !== null) {
    query.set(name, String(value));
  }
}
