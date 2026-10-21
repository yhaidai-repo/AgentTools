import { enabledRepos } from "@powerloom/core";
import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { Panel } from "@/components/Panel";
import { getDb } from "@/lib/db";
import { isResultKind, itemPath } from "@/lib/items";
import { formatDuration, formatUsd } from "@/lib/format";
import { obsidianDocsLink } from "@/lib/obsidian";
import type { PbiDetail } from "@/lib/pbiDetail";
import { versionKey } from "@/lib/resultLinks";
import { loadPbiResultSets } from "@/lib/resultVersions";
import type { ResultSet } from "@/models/ResultSet";
import type { ResultVersion } from "@/models/ResultVersion";
import { ResultBlock } from "../../results/ResultBlock";
import { ChildItems } from "./ChildItems";
import { ItemList } from "./ItemList";
import { PbiReposForm } from "./PbiReposForm";
import { PbiSkills } from "./PbiSkills";

type DraftRow = PbiDetail["drafts"][number];

// Every state but merged (and rejected, which is a human task instead) blocks the other agents.
const DRAFT_STATES: Record<string, string> = {
  pending: "not written yet: blocks the other agents",
  created: "in draft/, waiting to be verified and merged: blocks the other agents",
  appended: "in draft/, waiting to be verified and merged: blocks the other agents",
  merged: "merged into the docs vault",
};

// What the agents made of the PBI (user decision 2026-10-18: the first tab, in two columns): each result under its task
// with its versions behind a picker (user decision 2026-10-21) and every question and task in the main column; the
// runs, repos and skills beside them. `chosen` is the result version in the URL.
export async function AgentsTab({ detail, chosen }: { detail: PbiDetail; chosen: string | undefined }) {
  const sets = await loadPbiResultSets(detail.pbi.adoId);
  const hrefOf = (version: ResultVersion) => `/pbis/${detail.pbi.adoId}?tab=agents&v=${encodeURIComponent(versionKey(version))}`;

  return (
    <div className="pbi-columns">
      <div>
        {sets.map((set) => <Panel key={set.key} title={<SetTitle set={set} />} aside={<VersionCount set={set} />}><ResultBlock set={set} chosen={chosen} hrefOf={hrefOf} /></Panel>)}
        <InternalChildren detail={detail} />
        <QuestionsAndTasks detail={detail} />
      </div>
      <div>
        <Runs detail={detail} />
        <Panel title="Repos" aside={<small>what research and design clone</small>}><Repos detail={detail} /></Panel>
        <Panel title="Skills" aside={<small>for later agents</small>}><PbiSkills adoId={detail.pbi.adoId} skills={detail.pbi.skills} editedAt={detail.pbi.skillsEditedAt} /></Panel>
      </div>
    </div>
  );
}

// A research or test task's results name the task they answer; one span, so the panel's title row keeps it together.
function SetTitle({ set }: { set: ResultSet }) {
  return set.task ? <span>{set.title} · <Link href={itemPath(set.task)}>{set.task.id}</Link></span> : <span>{set.title}</span>;
}

function VersionCount({ set }: { set: ResultSet }) {
  return set.versions.length > 1 ? <small>{set.versions.length} versions</small> : null;
}

// Child items created in PowerLoom, e.g. the bugs an agent reported (user, 2026-10-21: internal bugs belong with the
// agents' work, not on the Azure DevOps tab); none, no panel.
function InternalChildren({ detail }: { detail: PbiDetail }) {
  const internal = detail.children.filter((child) => child.source !== "ado");

  if (internal.length === 0) {
    return null;
  }

  return <Panel title="Child items" aside={<small>reported in PowerLoom</small>} table><ChildItems items={internal} ado={null} /></Panel>;
}

// Questions, human tasks, findings and agent tasks in one list; findings wait for your review without holding the
// agents. Vault drafts follow as a quiet line, or as rows while one is unmerged.
function QuestionsAndTasks({ detail }: { detail: PbiDetail }) {
  const { items } = detail;
  const listed = items.filter((item) => !isResultKind(item.kind));

  return (
    <Panel title="Questions and tasks" aside={<small>{listed.length} · {listed.filter((item) => ["open", "in-progress"].includes(item.status)).length} open</small>}>
      <ItemList items={listed} results={items.filter((item) => isResultKind(item.kind))} empty="None yet." />
      <Drafts detail={detail} />
    </Panel>
  );
}

function Drafts({ detail }: { detail: PbiDetail }) {
  if (detail.drafts.length === 0) {
    return null;
  }

  return (
    <div className="drafts">
      {detail.drafts.map((draft) => (
        <p key={draft.id} className={draft.status === "merged" ? "text-faint" : "text-warn"}>
          Vault draft <DraftName vault={detail.pbi.vault} draft={draft} /> · {draftState(draft)} · <Link href={`/agents/runs/${draft.runId}`}>RUN-{draft.runId}</Link>
        </p>
      ))}
    </div>
  );
}

function DraftName({ vault, draft }: { vault: string; draft: DraftRow }) {
  // A merged draft is gone from draft/, so only unmerged ones get a link.
  const href = draft.filePath && draft.status !== "merged" ? obsidianDocsLink(draft.filePath, vault) : null;

  return href ? <a href={href}>{draft.name}</a> : <span>{draft.name}</span>;
}

function draftState(draft: DraftRow): string {
  return DRAFT_STATES[draft.status] ?? `rejected: ${draft.errors.join("; ")} (handed to you as a human task)`;
}

// Totals count finished runs only: a run gets its usage record when it ends. A running run pulses.
function Runs({ detail }: { detail: PbiDetail }) {
  const { usage } = detail;

  return (
    <Panel title="Runs" aside={<small>{formatDuration(usage.durationMs)} · {formatUsd(usage.costUsd)}</small>}>
      {detail.runs.length === 0 && <p className="empty">None yet.</p>}
      <div className="item-rows">
        {detail.runs.map((run) => (
          <div key={run.id} className="item-row">
            <span className={run.outcome === "running" ? "dot running" : run.outcome === "success" ? "dot ok" : "dot past-error"} />
            <Link href={`/agents/runs/${run.id}`} className="id">RUN-{run.id}</Link>
            <span className="item-title">{run.stage}</span>
            <span className="item-state">{run.outcome === "running" ? "running" : <LocalTime date={run.startedAt} />}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}

// What research and design clone: repos the vault documents or you confirmed; refinement's guesses wait for you.
// Repos disabled in Settings aren't listed, so saving never sends one the catalog refuses.
async function Repos({ detail }: { detail: PbiDetail }) {
  const catalog = await enabledRepos(getDb(), detail.pbi.vault);

  // Keyed by the saved list, so the form starts over from what was saved.
  return <PbiReposForm key={JSON.stringify(detail.repos)} adoId={detail.pbi.adoId} repos={detail.repos} catalog={catalog.map((row) => row.name)} />;
}
