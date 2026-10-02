// The Tasks page filters, read from the URL. pbi: "" any, "none" items without a PBI, or a PBI's id.
export interface TaskFilter {
  kind: string;
  status: "open" | "closed" | "all";
  pbi: string;
  /** A period key of lib/ranges (by when the item was created), shared with Agents and Runs. */
  range: string;
  sort: "created" | "updated";
  dir: "asc" | "desc";
}
