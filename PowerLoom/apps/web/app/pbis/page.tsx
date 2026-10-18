import { isAdoActive, readAdoSettings, readCurrentSprint, readRecentImports, readSyncSettings, type AdoSettings } from "@powerloom/core";
import { pipelineStatus, type PowerLoomDb } from "@powerloom/db";
import Link from "next/link";
import { AutoRefresh } from "@/components/AutoRefresh";
import { FocusRow } from "@/components/FocusRow";
import { NoVault } from "@/components/NoVault";
import { Pager } from "@/components/Pager";
import { RememberFilters } from "@/components/RememberFilters";
import { TimeAgo } from "@/components/TimeAgo";
import { groupBacklogRows } from "@/lib/backlogGroups";
import { PAGE_SIZES, pageCount, pageOf, pageSizeOf, slicePage } from "@/lib/backlogPages";
import { backlogUrl } from "@/lib/backlogUrl";
import { loadBacklogRows, loadLastSyncedAt } from "@/lib/backlogRows";
import { currentVault } from "@/lib/currentVault";
import { getDb } from "@/lib/db";
import { rememberedParams } from "@/lib/rememberedFilters";
import { sprintName } from "@/lib/sprintProgress";
import { loadSprintChoices } from "@/lib/sprints";
import type { BacklogRow } from "@/models/BacklogRow";
import type { BacklogView } from "@/models/BacklogView";
import { BacklogForm } from "./BacklogForm";
import { ImportsPanel } from "./ImportsPanel";
import { PbiTable } from "./PbiTable";
import { StatusPills } from "./StatusPills";
import { SyncForm } from "./SyncForm";
import { SyncNowButton } from "./SyncNowButton";
import { SyncPbiForm } from "./SyncPbiForm";

export const dynamic = "force-dynamic";

// Agents move PBIs between statuses all the time; the grid follows without a reload (user decision 2026-10-02).
const BACKLOG_REFRESH_MS = 10_000;
const IMPORTS_SHOWN = 20;

type SearchParams = Promise<{ status?: string; page?: string; size?: string; focus?: string }>;

const STATUSES: string[] = pipelineStatus.enumValues;

// Every PBI in PowerLoom, also those the sync no longer pulls (user decision 2026-10-02): status is the only filter.
// Latest change first, paged by PBI group (user decisions 2026-10-18); everything Azure DevOps brings in sits below.
export default async function PbisPage({ searchParams }: { searchParams: SearchParams }) {
  const vault = await currentVault();

  if (!vault) {
    return <NoVault title="Backlog" />;
  }

  // Coming back from a PBI only adds `focus`: the remembered filters still apply.
  const { focus: focusParam, ...asked } = await searchParams;
  const params = await rememberedParams("/pbis", asked);
  const statuses = (params.status ?? "").split(",").filter((status) => STATUSES.includes(status));
  const matches = (row: BacklogRow) => statuses.length === 0 || statuses.includes(row.pipelineStatus);
  const db = getDb();
  const ado = await readAdoSettings(db, vault);
  const rows = await loadBacklogRows(db, vault);
  const groups = groupBacklogRows(rows, matches);
  const size = pageSizeOf(params.size);
  const focus = Number(focusParam) || null;
  const view: BacklogView = { statuses, size, focus, page: pageOf(groups, size, params.page, focus) };

  return (
    <>
      <div className="page-head">
        <h1>Backlog</h1>
        <AutoRefresh active intervalMs={BACKLOG_REFRESH_MS} />
        <Link className="button page-action" href="/pbis/new">New PBI</Link>
      </div>
      <RememberFilters />
      <div className="backlog-bar">
        <StatusPills rows={rows} statuses={STATUSES} view={view} />
        {isAdoActive(ado) && <SyncLine db={db} vault={vault} />}
      </div>
      <BacklogForm>
        <PbiTable groups={slicePage(groups, size, view.page)} ado={ado} focus={focus} />
      </BacklogForm>
      {groups.length === 0 ? <p className="empty-note">No PBIs match. Check the status, or sync a sprint.</p> : <Pager page={view.page} size={size} sizes={PAGE_SIZES} pages={pageCount(groups, size)} total={groups.length} noun="PBIs" hrefOf={(change) => backlogUrl({ statuses, size: change.size ?? size, page: change.page })} />}
      {focus !== null && <FocusRow rowId={`pbi-${focus}`} />}
      <div className="section-label">Sync and imports</div>
      <SyncSection db={db} vault={vault} ado={ado} />
    </>
  );
}

// Above the table: the sprint the sync pulls, when the vault last synced, and Sync now.
async function SyncLine({ db, vault }: { db: PowerLoomDb; vault: string }) {
  const sync = await readSyncSettings(db, vault);
  const current = await readCurrentSprint(db, vault);
  const lastSynced = await loadLastSyncedAt(db, vault);
  const sprint = sync.sprint === "current" ? current : sync.sprint;

  return (
    <div className="sync-line">
      <span className="dot ok" />
      <span>Sprint {sprint ? sprintName(sprint) : "–"} · synced {lastSynced ? <TimeAgo date={lastSynced} /> : "never"}</span>
      <SyncNowButton sprint={sync.sprint} />
    </div>
  );
}

// Everything Azure DevOps brings in sits together, only with the vault's integration on (user decision 2026-10-06).
async function SyncSection({ db, vault, ado }: { db: PowerLoomDb; vault: string; ado: AdoSettings | null }) {
  if (!isAdoActive(ado)) {
    return <p className="empty-note">No Azure DevOps integration for <code>{vault}</code>: enable it in <Link href="/settings">Settings</Link> to sync and import PBIs.</p>;
  }

  const sync = await readSyncSettings(db, vault);

  return (
    <>
      <div className="sync-panel panel">
        <h3>PBI sync</h3>
        <div className="panel-body sync-forms">
          <SyncForm sprint={sync.sprint} options={await loadSprintChoices(ado)} current={await readCurrentSprint(db, vault)} />
          <SyncPbiForm />
        </div>
      </div>
      <ImportsPanel imports={await readRecentImports(db, vault, null, IMPORTS_SHOWN)} />
    </>
  );
}
