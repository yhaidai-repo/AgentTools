import Link from "next/link";
import { Folded } from "@/components/Folded";
import { TimeAgo } from "@/components/TimeAgo";
import { loadResult } from "@/lib/resultContent";
import { chosenVersion, resultPath } from "@/lib/resultLinks";
import type { ResultSet } from "@/models/ResultSet";
import type { ResultVersion } from "@/models/ResultVersion";
import { ResultBody } from "./ResultBody";
import { ResultVersionPicker } from "./ResultVersionPicker";

interface ResultBlockProps {
  set: ResultSet;
  /** The page's `v` parameter. */
  chosen: string | undefined;
  /** Where picking a version goes: this page with its `v`. */
  hrefOf: (version: ResultVersion) => string;
}

// One result under its task (user decision 2026-10-21): the chosen version (the latest by default) and who wrote it,
// the other versions one click away, long content folded, and the version's full page.
export async function ResultBlock({ set, chosen, hrefOf }: ResultBlockProps) {
  const version = chosenVersion(set.versions, chosen ?? set.preferred);

  if (!version) {
    return set.empty ? <p className="empty">{set.empty}</p> : null;
  }

  const result = await loadResult(version.kind, version.id);

  return (
    <div className="result-block">
      <ResultMeta version={version} />
      <ResultVersionPicker versions={set.versions} chosen={version} hrefOf={hrefOf} />
      {result ? <Folded><ResultBody result={result} /></Folded> : <p className="muted">This version is no longer stored.</p>}
    </div>
  );
}

// The version, who wrote it and when, and the way to its full page.
export function ResultMeta({ version, withOpen = true }: { version: ResultVersion; withOpen?: boolean }) {
  return (
    <p className="result-meta">
      <span className="result-version">{version.label}</span>
      {version.agent && <span>{version.agent}</span>}
      {version.runId !== null && <Link href={`/agents/runs/${version.runId}`}>RUN-{version.runId}</Link>}
      <TimeAgo date={version.at} />
      {version.status && version.status !== "final" && <span className="result-status">{version.status}</span>}
      {withOpen && <Link href={resultPath(version)} className="result-open">Open full page ↗</Link>}
    </p>
  );
}
