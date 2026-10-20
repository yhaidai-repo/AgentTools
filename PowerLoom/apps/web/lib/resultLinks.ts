import type { ResultKind } from "@/models/ResultKind";
import type { ResultVersion } from "@/models/ResultVersion";

const KINDS: ResultKind[] = ["refinement", "design", "estimate", "item", "review"];

// A version's key in the `v` query parameter of the page that shows it, e.g. design-7 or item-TR-30474-012.
export function versionKey(version: Pick<ResultVersion, "kind" | "id">): string {
  return `${version.kind}-${version.id}`;
}

// The version a block shows: the one the page's `v` names when it is one of the block's, else the latest.
export function chosenVersion(versions: ResultVersion[], chosen: string | undefined): ResultVersion | null {
  return versions.find((version) => versionKey(version) === chosen) ?? versions.at(-1) ?? null;
}

// The full page of one result version.
export function resultPath(version: Pick<ResultVersion, "kind" | "id">): string {
  return `/results/${version.kind}/${encodeURIComponent(version.id)}`;
}

export function resultKindOf(value: string): ResultKind | null {
  return KINDS.find((kind) => kind === value) ?? null;
}
