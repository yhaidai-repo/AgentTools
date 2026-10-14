import { AdoRequestError } from "@powerloom/ado";
import type { AdoAccess } from "../models/AdoAccess";
import type { OutsideResource } from "../models/OutsideResource";
import type { OutsideToolResult } from "../models/OutsideToolResult";

// One result is cut here so a long work item or thread list can't fill the agent's context.
const MAX_CHARS = 60_000;

// One resource per area: a denied call opens one access request per area, as the PAT has a scope per area.
export const WORK_ITEMS = "Azure DevOps work items";
export const PULL_REQUESTS = "Azure DevOps pull requests";
export const TEST_CASES = "Azure DevOps test cases";

export function adoResource(access: AdoAccess, resource: string): OutsideResource {
  return { kind: "ado", resource, target: access.orgUrl };
}

export function limitedResult(text: string, rows: number): OutsideToolResult {
  if (text.length <= MAX_CHARS) {
    return { text, rows };
  }

  return { text: `${text.slice(0, MAX_CHARS)}\n\n[cut at ${MAX_CHARS} of ${text.length} characters]`, rows, truncated: true };
}

// 401/403: the PAT lost its rights, lacks the area's scope or expired; anything else is an ordinary failure.
export function adoFailure(error: unknown): OutsideToolResult {
  const message = error instanceof Error ? error.message : String(error);
  const denied = error instanceof AdoRequestError && (error.status === 401 || error.status === 403);

  return { text: `Azure DevOps refused or failed: ${message}`, isError: true, denied };
}
