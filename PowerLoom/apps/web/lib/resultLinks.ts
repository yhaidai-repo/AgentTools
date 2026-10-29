import type { ResultVersion } from "@/models/ResultVersion";

export { chosenVersion, pbiResultKindOf, resultKindOf, versionKey } from "@powerloom/core";

const LATEST_OF_PBI = /^PBI-(\d+)$/;

// The full page of one result version.
export function resultPath(version: Pick<ResultVersion, "kind" | "id">): string {
  return `/results/${version.kind}/${encodeURIComponent(version.id)}`;
}

// The address of a PBI's latest result of a kind, which the result page redirects to that version's own page.
export function latestResultPath(kind: string, adoId: number): string {
  return `/results/${kind}/PBI-${adoId}`;
}

// The PBI a latest-result address names, null for a version's own id.
export function latestResultPbi(id: string): number | null {
  const match = LATEST_OF_PBI.exec(id);

  return match ? Number(match[1]) : null;
}
