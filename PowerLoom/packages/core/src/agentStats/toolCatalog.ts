import type { DataAccessCall } from "../models/DataAccessCall";
import type { ToolCatalogRow } from "../models/ToolCatalogRow";
import type { ToolOffer } from "../models/ToolOffer";

// What gives the tools every agent run has (docs, its PBI, write_result, …); the panel lists them first.
export const EVERY_AGENT = "Every agent";

// A tool that was called but no current run or session has (an older grant, a tool the Azure MCP server named).
export const SEEN_IN_CALLS_ONLY = "Seen in calls only";

/** Every tool the runs and chats were given, plus any other tool called in the period: who has it, its calls in the
 *  period, and its last call ever. Ordered by what gives it, then by name. */
export function toolCatalog(offers: ToolOffer[], inPeriod: DataAccessCall[], latestEver: Map<string, Date>): ToolCatalogRow[] {
  const rows = new Map<string, ToolCatalogRow>();

  for (const offer of offers) {
    addOffer(rows, offer);
  }

  for (const call of inPeriod) {
    addCall(rows, call);
  }

  return [...rows.values()].map((row) => ({ ...row, holders: row.holders.sort(), lastUsed: latestEver.get(row.name) ?? null })).sort(bySourceThenName);
}

function addOffer(rows: Map<string, ToolCatalogRow>, offer: ToolOffer): void {
  for (const tool of offer.tools) {
    const row = rows.get(tool.name) ?? { ...tool, holders: [], calls: 0, failed: 0, lastUsed: null };

    rows.set(tool.name, { ...row, holders: [...new Set([...row.holders, offer.holder])] });
  }
}

function addCall(rows: Map<string, ToolCatalogRow>, call: DataAccessCall): void {
  const row = rows.get(call.tool) ?? { name: call.tool, summary: "", source: SEEN_IN_CALLS_ONLY, holders: [], calls: 0, failed: 0, lastUsed: null };
  const failed = call.outcome === "ok" ? 0 : 1;

  rows.set(call.tool, { ...row, calls: row.calls + 1, failed: row.failed + failed });
}

function bySourceThenName(left: ToolCatalogRow, right: ToolCatalogRow): number {
  return sourceRank(left.source) - sourceRank(right.source) || left.source.localeCompare(right.source) || left.name.localeCompare(right.name);
}

// The tools every agent has first, the calls without a holder last.
function sourceRank(source: string): number {
  if (source === EVERY_AGENT) {
    return 0;
  }

  return source === SEEN_IN_CALLS_ONLY ? 2 : 1;
}
