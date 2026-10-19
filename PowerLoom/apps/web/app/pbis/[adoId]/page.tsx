import { notFound } from "next/navigation";
import { AutoRefresh } from "@/components/AutoRefresh";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { loadChangedAt } from "@/lib/backlogRows";
import { getDb } from "@/lib/db";
import { isOpen } from "@/lib/items";
import { loadPbiDetail } from "@/lib/pbiDetail";
import { loadMetroLine } from "@/lib/pipelineMetro";
import type { Crumb } from "@/models/Crumb";
import { AdoTab } from "./AdoTab";
import { AgentsTab } from "./AgentsTab";
import { NotesTab } from "./NotesTab";
import { PbiHeader } from "./PbiHeader";
import { DEFAULT_PBI_TAB, PBI_TABS, PbiTabs } from "./PbiTabs";

export const dynamic = "force-dynamic";

// While an agent runs on the PBI the page follows it, like the Backlog.
const RUNNING_REFRESH_MS = 10_000;

// `problem`: what New PBI couldn't save with the PBI it created (a repo, a file).
type SearchParams = Promise<{ tab?: string; problem?: string }>;

// The header with everything at hand, then three tabs (user decision 2026-10-13; Agents first since 2026-10-18): what
// the agents made of the PBI, the PBI as Azure DevOps has it, the user's own notes.
export default async function PbiPage({ params, searchParams }: { params: Promise<{ adoId: string }>; searchParams: SearchParams }) {
  const adoId = Number((await params).adoId);
  const { tab: requestedTab, problem } = await searchParams;
  const tab = PBI_TABS.find((choice) => choice.key === requestedTab)?.key ?? DEFAULT_PBI_TAB;
  const detail = Number.isInteger(adoId) ? await loadPbiDetail(adoId) : null;

  if (!detail) {
    notFound();
  }

  const [stations, changedAt] = await Promise.all([loadMetroLine(adoId, detail.pbi.pipelineStatus), loadChangedAt(getDb(), adoId)]);
  const waiting = detail.items.filter((item) => isOpen(item) && item.assignee === "human" && item.kind !== "finding").length;
  const running = detail.runs.some((run) => run.outcome === "running");

  return (
    <>
      <Breadcrumbs crumbs={crumbsOf(adoId, detail.parent)} />
      <AutoRefresh active={running} intervalMs={RUNNING_REFRESH_MS} />
      {problem && <p className="create-problem">PBI-{adoId} was created, but: {problem} Fix it below.</p>}
      <PbiHeader detail={detail} stations={stations} changedAt={changedAt} />
      <PbiTabs adoId={adoId} active={tab} waiting={waiting} />
      {tab === "agents" && <AgentsTab detail={detail} />}
      {tab === "ado" && <AdoTab detail={detail} />}
      {tab === "notes" && <NotesTab adoId={adoId} />}
    </>
  );
}

// Back to the Backlog at this PBI's row, with the filters you had (user request 2026-10-18); a child shows its parent.
function crumbsOf(adoId: number, parent: { adoId: number } | null): Crumb[] {
  const backlog: Crumb = { label: "Backlog", href: `/pbis?focus=${parent?.adoId ?? adoId}` };
  const parentCrumb: Crumb[] = parent ? [{ label: `PBI-${parent.adoId}`, href: `/pbis/${parent.adoId}` }] : [];

  return [backlog, ...parentCrumb, { label: `PBI-${adoId}` }];
}
