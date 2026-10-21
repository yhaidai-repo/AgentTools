import { isDeletableItem, isHumanTaskData, isRerunnableTask } from "@powerloom/core";
import Link from "next/link";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { Dropdown } from "@/components/Dropdown";
import { HeroStat } from "@/components/HeroStat";
import { NoteLink } from "@/components/NoteLink";
import { PbiLinkedText } from "@/components/PbiLinkedText";
import { TaskKindTag, TaskStatePill } from "@/components/TaskTags";
import { TimeAgo } from "@/components/TimeAgo";
import { formatAge } from "@/lib/format";
import { itemPath } from "@/lib/items";
import type { ItemDetail } from "@/lib/pbiDetail";
import { taskBucket } from "@/lib/taskLooks";
import type { Crumb } from "@/models/Crumb";
import { ContinueItem } from "./ContinueItem";
import { DeleteItemButton } from "./DeleteItemButton";
import { ItemProgress } from "./ItemProgress";
import { RerunTaskButton } from "./RerunTaskButton";

// A task's header, like the PBI page's (user request 2026-10-18): where it sits, what it is and its state, one primary
// action, its facts, a few numbers and its way from created to done.
export function ItemHeader({ detail }: { detail: ItemDetail }) {
  const { item } = detail;
  const waitsForYou = taskBucket(item) === "you";

  return (
    <>
      <Breadcrumbs crumbs={crumbsOf(item)} />
      <section className="pbi-hero">
        <div className="hero-top">
          <div className="hero-title">
            <div className="hero-id"><span className="id">{item.id}</span><TaskKindTag kind={item.kind} /><TaskStatePill task={item} /></div>
            <h1 className="item-title-head"><PbiLinkedText text={item.title} /></h1>
          </div>
          <div className="hero-actions">
            {waitsForYou && <a className="button" href="#answer">{item.kind === "question" ? "Answer" : item.kind === "finding" ? "Review" : "Close the task"}</a>}
            {isRerunnableTask(item) && <RerunTaskButton adoId={item.pbiId} itemId={item.id} />}
            <ContinueItem item={item} />
            {isDeletableItem(item) && (
              <Dropdown label="More actions" align="right" pill trigger={<span aria-hidden="true">⋯</span>}>
                <DeleteItemButton adoId={item.pbiId} itemId={item.id} inMenu />
              </Dropdown>
            )}
          </div>
        </div>
        <Facts detail={detail} />
        <Stats detail={detail} />
        <ItemProgress item={item} running={detail.runs.some((run) => run.outcome === "running")} />
      </section>
    </>
  );
}

// Back to the PBI (and the Backlog at its row), or to Tasks for an item without a PBI.
function crumbsOf(item: ItemDetail["item"]): Crumb[] {
  if (item.pbiId === null) {
    return [{ label: "Tasks", href: "/tasks" }, { label: item.id }];
  }

  return [{ label: "Backlog", href: `/pbis?focus=${item.pbiId}` }, { label: `PBI-${item.pbiId}`, href: `/pbis/${item.pbiId}` }, { label: item.id }];
}

function Facts({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  return (
    <div className="hero-facts">
      {item.pbiId !== null && <Fact label="PBI"><Link href={`/pbis/${item.pbiId}`}>PBI-{item.pbiId}</Link></Fact>}
      {item.parentId && <Fact label="From"><Link href={itemPath({ id: item.parentId, pbiId: item.pbiId })}>{item.parentId}</Link></Fact>}
      {item.createdByRun && <Fact label="Created by"><Link href={`/agents/runs/${item.createdByRun}`}>RUN-{item.createdByRun}</Link></Fact>}
      <Fact label="Updated"><span className="mono"><TimeAgo date={item.updatedAt} /></span></Fact>
      {item.vaultPath && <span className="fact-link"><NoteLink vault={item.vault} path={item.vaultPath} label="Vault note" /></span>}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <span className="fact"><b>{label}</b>{children}</span>;
}

// Steps to report breathes amber while the task waits for you; held shows why the dispatcher hasn't started it, blocked
// why the agents stopped trying.
function Stats({ detail }: { detail: ItemDetail }) {
  const { item } = detail;
  const steps = isHumanTaskData(item.data) ? item.data.steps.length : null;
  const bucket = taskBucket(item);

  return (
    <div className="hero-stats item-stats">
      {steps !== null && <HeroStat label="Steps to report" value={String(steps)} tone={bucket === "you" ? "warn" : undefined} />}
      <HeroStat label={isClosed(bucket) ? "Took" : "Open for"} value={formatAge(ageOf(item, isClosed(bucket)))} />
      <HeroStat label="Runs" value={String(detail.runs.length)} />
      <HeroStat label="Assigned" value={assigneeLabel(item.assignee)} />
      {bucket === "held" && <p className="held-note">Held by the dispatcher: {[...new Set(item.heldBy)].join("; ")}</p>}
      {item.status === "blocked" && <p className="held-note">Blocked: {blockReason(detail)}</p>}
    </div>
  );
}

// Older blocks (budget stops and repeated failures before 2026-10-21) kept no reason: the last run and how it ended say it.
function blockReason(detail: ItemDetail): string {
  const { item } = detail;
  const last = detail.runs[0];

  if (item.heldBy.length > 0) {
    return [...new Set(item.heldBy)].join("; ");
  }

  return last ? `its last run, RUN-${last.id}, ended ${last.outcome.replaceAll("-", " ")}. Re-run when the cause is fixed.` : "no reason was kept. Re-run when the cause is fixed.";
}

// "agent:*" is any agent that takes the task's kind.
function assigneeLabel(assignee: string): string {
  if (assignee === "human") {
    return "You";
  }

  const agent = assignee.replace("agent:", "");

  return agent === "*" ? "Any agent" : agent;
}

function isClosed(bucket: string): boolean {
  return bucket === "done" || bucket === "cancelled";
}

// A closed task: from created to its last change; an open one: from created to now.
function ageOf(item: ItemDetail["item"], closed: boolean): number {
  const end = closed ? new Date(item.updatedAt).getTime() : Date.now();

  return end - new Date(item.createdAt).getTime();
}
