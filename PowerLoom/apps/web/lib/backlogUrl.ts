import type { BacklogView } from "@/models/BacklogView";

// The Backlog's address for a view: the status filter, the page and its size, and the PBI to come back to.
export function backlogUrl(view: Partial<BacklogView>): string {
  const query = new URLSearchParams();

  query.set("status", (view.statuses ?? []).join(","));
  addNumber(query, "page", view.page && view.page > 1 ? view.page : null);
  addNumber(query, "size", view.size ?? null);
  addNumber(query, "focus", view.focus ?? null);

  return `/pbis?${query.toString()}`;
}

function addNumber(query: URLSearchParams, name: string, value: number | null): void {
  if (value !== null) {
    query.set(name, String(value));
  }
}
