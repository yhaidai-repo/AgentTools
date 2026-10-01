import { attachmentRef, isDeletableItem, isRerunnableTask } from "@adoa/core";
import { ACCEPTED_EXTENSIONS } from "@adoa/attachments";
import Link from "next/link";
import { NoteLink } from "@/components/NoteLink";
import { isOpen, itemPath } from "@/lib/items";
import type { ItemDetail } from "@/lib/pbiDetail";
import type { FindingData } from "@/models/FindingData";
import { CloseItemForm } from "./CloseItemForm";
import { DeleteItemButton } from "./DeleteItemButton";
import { FindingForm } from "./FindingForm";
import { ItemContent } from "./ItemContent";
import { RerunTaskButton } from "./RerunTaskButton";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

// One item's page, under its PBI or (for items without one) under Tasks.
export function ItemView({ detail }: { detail: ItemDetail }) {
  const { item } = detail;
  const adoId = item.pbiId;

  return (
    <>
      <h1>{item.id} · {item.title}</h1>
      <p>{adoId === null ? <Link href="/tasks">← Tasks</Link> : <Link href={`/pbis/${adoId}`}>← PBI-{adoId}</Link>}{item.vaultPath && <> · <NoteLink path={item.vaultPath} label="open note" /></>}</p>
      <div className="chips">
        <span className="chip">{item.kind}</span>
        <span className={`chip ${isOpen(item) && item.assignee === "human" ? "result-error" : ""}`}>status: {item.status}</span>
        <span className="chip">for: {item.assignee}</span>
        {item.createdByRun && <Link className="chip" href={`/agents/runs/${item.createdByRun}`}>created by RUN-{item.createdByRun}</Link>}
        {item.parentId && <Link className="chip" href={itemPath({ id: item.parentId, pbiId: adoId })}>from {item.parentId}</Link>}
      </div>
      <p className="actions">
        {isRerunnableTask(item) && <RerunTaskButton adoId={adoId} itemId={item.id} />}
        {isDeletableItem(item) && <DeleteItemButton adoId={adoId} itemId={item.id} />}
      </p>
      {item.status === "deleted" && <p className="result-error">Deleted: hidden everywhere; agents won&apos;t create it again.</p>}
      {item.status === "open" && item.heldBy.length > 0 && <p className="result-error">Held by the dispatcher: {item.heldBy.join("; ")}</p>}
      <ItemContent item={item} />
      <Results detail={detail} />
      <Findings detail={detail} />
      <Resolution detail={detail} />
    </>
  );
}

// A research task shows its results inside it (newest last; a re-run supersedes the earlier one).
function Results({ detail }: { detail: ItemDetail }) {
  if (detail.item.kind !== "research") {
    return null;
  }

  if (detail.results.length === 0) {
    return <p className="muted">No result yet.</p>;
  }

  return (
    <>
      {detail.results.map((result) => (
        <section key={result.id} className="card result-section">
          <h2>Result {result.id} · {result.status}{result.createdByRun ? ` · RUN-${result.createdByRun}` : ""}</h2>
          <ItemContent item={result} />
        </section>
      ))}
    </>
  );
}

// Open questions and known issues the tech-writer raised while merging this task's draft.
function Findings({ detail }: { detail: ItemDetail }) {
  if (detail.findings.length === 0) {
    return null;
  }

  return (
    <>
      <h2>Findings</h2>
      <ul className="item-list">
        {detail.findings.map((finding) => (
          <li key={finding.id}><Link href={itemPath(finding)}>{finding.id}</Link> · {finding.status} · {finding.title}</li>
        ))}
      </ul>
    </>
  );
}

// Open human items get their forms; closed ones show what was answered and uploaded.
function Resolution({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  if (item.assignee !== "human") {
    return null;
  }

  if (item.kind === "finding" && item.status === "in-progress") {
    return <p className="muted">Being added to the register; reload in a moment.</p>;
  }

  return isOpen(item) ? <OpenForms detail={detail} /> : <ClosedOutcome detail={detail} />;
}

function OpenForms({ detail }: { detail: ItemDetail }) {
  const { item } = detail;

  if (item.kind !== "finding") {
    return (
      <>
        <h2>{item.kind === "question" ? "Your answer" : "Close the task"}</h2>
        <CloseItemForm adoId={item.pbiId} itemId={item.id} kind={item.kind} accept={ACCEPT} />
      </>
    );
  }

  return (
    <>
      <h2>Submit to vault</h2>
      <FindingForm adoId={item.pbiId} itemId={item.id} title={item.title} text={item.body ?? ""} data={item.data as FindingData} />
      <h2>Or close it here</h2>
      <CloseItemForm adoId={item.pbiId} itemId={item.id} kind={item.kind} accept={ACCEPT} />
    </>
  );
}

function ClosedOutcome({ detail }: { detail: ItemDetail }) {
  const { item, attachments } = detail;

  return (
    <>
      <h2>{item.kind === "human" ? "Outcome" : "Answer"}</h2>
      <p>{item.status}{item.resolution ? `: ${item.resolution}` : ""}</p>
      {attachments.length > 0 && (
        <ul>
          {attachments.map((entry) => <li key={entry.id}><a href={`/pbis/${item.pbiId}/attachments/${entry.id}`}>{attachmentRef(entry.id)} {entry.fileName}</a></li>)}
        </ul>
      )}
    </>
  );
}
