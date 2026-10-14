import type { AdoPullRequestSearch } from "./models/AdoPullRequestSearch";

// The search's filters as ADO's searchCriteria query parameters (the repository is part of the path); filters left
// out don't filter.
export function pullRequestCriteria(search: AdoPullRequestSearch): string {
  const criteria: Record<string, string | undefined> = {
    status: search.status,
    sourceRefName: search.sourceRef,
    targetRefName: search.targetRef,
  };
  const given = Object.entries(criteria).filter((entry): entry is [string, string] => entry[1] !== undefined);

  return given.map(([key, value]) => `searchCriteria.${key}=${encodeURIComponent(value)}`).join("&");
}
