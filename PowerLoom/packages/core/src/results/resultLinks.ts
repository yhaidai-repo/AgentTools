import type { PbiResultKind } from "../models/PbiResultKind";
import type { ResultKind } from "../models/ResultKind";
import type { ResultVersion } from "../models/ResultVersion";

// Every kind a result page's URL and result.get accept.
export const RESULT_KIND_NAMES = ["refinement", "plan", "build", "design", "estimate", "item", "review", "run"] as const satisfies readonly ResultKind[];

// The kinds a PBI owns versions of, which `PBI-<id>:<kind>` references name.
export const PBI_RESULT_KIND_NAMES = ["refinement", "plan", "build", "design", "estimate"] as const satisfies readonly PbiResultKind[];

// A version's key in the `v` query parameter of the page that shows it, e.g. design-7 or item-TR-30474-012.
export function versionKey(version: Pick<ResultVersion, "kind" | "id">): string {
  return `${version.kind}-${version.id}`;
}

// The version a block shows: the one the page's `v` names when it is one of the block's, else the latest.
export function chosenVersion(versions: ResultVersion[], chosen: string | undefined): ResultVersion | null {
  return versions.find((version) => versionKey(version) === chosen) ?? versions.at(-1) ?? null;
}

export function resultKindOf(value: string): ResultKind | null {
  return RESULT_KIND_NAMES.find((kind) => kind === value) ?? null;
}

export function pbiResultKindOf(value: string): PbiResultKind | null {
  return PBI_RESULT_KIND_NAMES.find((kind) => kind === value) ?? null;
}
