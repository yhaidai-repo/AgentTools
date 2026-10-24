/** One tool on the Tools tab's All tools panel: what gives it, who has it, and its calls in the period. */
export interface ToolCatalogRow {
  name: string;
  summary: string;
  source: string;
  /** The agents (and "chat") whose latest run or session had it. */
  holders: string[];
  calls: number;
  failed: number;
  lastUsed: Date | null;
}
