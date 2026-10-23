import type { ResultVersion } from "@/models/ResultVersion";

export { chosenVersion, resultKindOf, versionKey } from "@powerloom/core";

// The full page of one result version.
export function resultPath(version: Pick<ResultVersion, "kind" | "id">): string {
  return `/results/${version.kind}/${encodeURIComponent(version.id)}`;
}
