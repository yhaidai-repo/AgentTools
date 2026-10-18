import type { TaskFilter } from "@/models/TaskFilter";

// Waits on you first is the default, so only the other order is written.
export const UPDATED_FIRST = "updated";

// The Tasks page's address for a view: its filters, the page and its size.
export function tasksUrl(filter: Partial<TaskFilter>): string {
  const query = new URLSearchParams();

  query.set("status", filter.status ?? "all");
  setIfAny(query, "kind", filter.kind);
  setIfAny(query, "pbi", filter.pbi);
  setIfAny(query, "range", filter.range);
  setIfAny(query, "sort", filter.youFirst === false ? UPDATED_FIRST : undefined);
  setIfAny(query, "page", filter.page && filter.page > 1 ? String(filter.page) : undefined);
  setIfAny(query, "size", filter.size ? String(filter.size) : undefined);

  return `/tasks?${query.toString()}`;
}

function setIfAny(query: URLSearchParams, name: string, value: string | undefined): void {
  if (value) {
    query.set(name, value);
  }
}
