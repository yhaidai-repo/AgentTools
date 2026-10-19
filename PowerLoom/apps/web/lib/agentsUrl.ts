import { pageUrl } from "./pageUrl";

// The Agents page's address: its tab and that tab's choices (period, agent, outcome, page, size).
export function agentsUrl(params: Record<string, string | number | undefined>): string {
  return pageUrl("/agents", params);
}
