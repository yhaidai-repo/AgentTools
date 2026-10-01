// The Tasks page filters, read from the URL. pbi: "" any, "none" items without a PBI, or a PBI's id.
export interface TaskFilter {
  kind: string;
  status: "open" | "closed" | "all";
  pbi: string;
}
