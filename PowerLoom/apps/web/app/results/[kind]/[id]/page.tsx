import { notFound, redirect } from "next/navigation";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { loadResult, resultOwner } from "@/lib/resultContent";
import { latestResultPbi, pbiResultKindOf, resultKindOf, resultPath, versionKey } from "@/lib/resultLinks";
import { loadLatestPbiVersion, loadSiblingVersions } from "@/lib/resultVersions";
import type { AgentResult } from "@/models/AgentResult";
import type { Crumb } from "@/models/Crumb";
import type { ResultVersion } from "@/models/ResultVersion";
import { ResultBody } from "../../ResultBody";
import { ResultMeta } from "../../ResultBlock";
import { ResultVersionPicker } from "../../ResultVersionPicker";
import { RunResultHeader } from "../../RunResultHeader";

export const dynamic = "force-dynamic";

const ITEM_TITLES: Record<string, string> = { "research-result": "Research result", "test-report": "Test report" };
const TITLES: Record<Exclude<AgentResult["kind"], "item">, string> = { refinement: "Refinement", plan: "Plan", build: "Build", design: "Design", estimate: "Estimate", review: "Review", run: "Run result" };

// One agent result version on a page of its own (user decision 2026-10-21): the whole width, so its tables get room,
// unfolded, with its other versions one click away. A run result starts with where it comes from. The address of a
// PBI's latest result (/results/plan/PBI-1, where PBI-1:plan references link) opens that version's own page.
export default async function ResultPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind: kindParam, id } = await params;
  const kind = resultKindOf(kindParam);
  const latestOfPbi = latestResultPbi(decodeURIComponent(id));

  if (kind && latestOfPbi !== null) {
    redirect(await latestVersionPath(kind, latestOfPbi));
  }

  const result = kind ? await loadResult(kind, decodeURIComponent(id)) : null;

  if (!result) {
    notFound();
  }

  const owner = await resultOwner(result);
  const versions = await loadSiblingVersions(result, owner);
  const version = versions.find((candidate) => versionKey(candidate) === versionKey({ kind: result.kind, id: String(result.row.id) })) ?? null;
  const title = `${titleOf(result)}${version ? ` ${version.label}` : ""}`;

  return (
    <>
      <Breadcrumbs crumbs={crumbsOf(owner, title)} />
      <div className="page-head"><h1>{title}</h1></div>
      {version && <VersionBar versions={versions} version={version} />}
      <section className="card result-page">
        {result.kind === "run" && <RunResultHeader row={result.row} />}
        <ResultBody result={result} />
      </section>
    </>
  );
}

// The own page of the PBI's newest version of the kind; a kind no PBI owns (a review, a run result) or a PBI without
// one of that kind has no page to open.
async function latestVersionPath(kind: string, adoId: number): Promise<string> {
  const pbiKind = pbiResultKindOf(kind);
  const latest = pbiKind ? await loadLatestPbiVersion(pbiKind, adoId) : null;

  if (!latest) {
    notFound();
  }

  return resultPath(latest);
}

function VersionBar({ versions, version }: { versions: ResultVersion[]; version: ResultVersion }) {
  return (
    <div className="result-page-bar">
      <ResultMeta version={version} withOpen={false} />
      <ResultVersionPicker versions={versions} chosen={version} hrefOf={resultPath} />
    </div>
  );
}

function titleOf(result: AgentResult): string {
  return result.kind === "item" ? ITEM_TITLES[result.row.kind] ?? "Result" : TITLES[result.kind];
}

function crumbsOf(owner: { pbiId: number | null; taskId: string | null }, title: string): Crumb[] {
  const task: Crumb[] = owner.taskId === null ? [] : [{ label: owner.taskId, href: owner.pbiId === null ? `/tasks/${owner.taskId}` : `/pbis/${owner.pbiId}/items/${owner.taskId}` }];

  if (owner.pbiId === null) {
    return [{ label: "Tasks", href: "/tasks" }, ...task, { label: title }];
  }

  return [{ label: "Backlog", href: `/pbis?focus=${owner.pbiId}` }, { label: `PBI-${owner.pbiId}`, href: `/pbis/${owner.pbiId}` }, ...task, { label: title }];
}
