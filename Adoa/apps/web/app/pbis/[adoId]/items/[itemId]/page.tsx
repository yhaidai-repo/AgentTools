import { attachmentRef, isDeletableItem, isRerunnableTask } from "@adoa/core";
import { ACCEPTED_EXTENSIONS } from "@adoa/attachments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { NoteLink } from "@/components/NoteLink";
import { loadItemDetail, type ItemDetail } from "@/lib/pbiDetail";
import { CloseItemForm } from "../../CloseItemForm";
import { isOpen } from "../../ItemList";
import { DeleteItemButton } from "./DeleteItemButton";
import { RerunTaskButton } from "./RerunTaskButton";
import { ItemContent } from "./ItemContent";

export const dynamic = "force-dynamic";

export default async function ItemPage({ params }: { params: Promise<{ adoId: string; itemId: string }> }) {
  const { adoId: rawAdoId, itemId } = await params;
  const adoId = Number(rawAdoId);
  const detail = Number.isInteger(adoId) ? await loadItemDetail(adoId, decodeURIComponent(itemId)) : null;

  if (!detail) {
    notFound();
  }

  const { item } = detail;

  return (
    <>
      <h1>{item.id} · {item.title}</h1>
      <p><Link href={`/pbis/${adoId}`}>← PBI-{adoId}</Link>{item.vaultPath && <> · <NoteLink path={item.vaultPath} label="open note" /></>}</p>
      <div className="chips">
        <span className="chip">{item.kind}</span>
        <span className={`chip ${isOpen(item) && item.assignee === "human" ? "result-error" : ""}`}>status: {item.status}</span>
        <span className="chip">for: {item.assignee}</span>
        {item.createdByRun && <Link className="chip" href={`/agents/runs/${item.createdByRun}`}>created by RUN-{item.createdByRun}</Link>}
        {item.parentId && <Link className="chip" href={`/pbis/${adoId}/items/${item.parentId}`}>from {item.parentId}</Link>}
      </div>
      <p className="actions">
        {isRerunnableTask(item) && <RerunTaskButton adoId={adoId} itemId={item.id} />}
        {isDeletableItem(item) && <DeleteItemButton adoId={adoId} itemId={item.id} />}
      </p>
      {item.status === "deleted" && <p className="result-error">Deleted: hidden everywhere; agents won&apos;t create it again.</p>}
      {item.status === "open" && item.heldBy.length > 0 && <p className="result-error">Held by the dispatcher: {item.heldBy.join("; ")}</p>}
      <ItemContent item={item} />
      <Results detail={detail} />
      <Resolution detail={detail} adoId={adoId} />
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

// Open human items get the answer form; closed ones show what was answered and uploaded.
function Resolution({ detail, adoId }: { detail: ItemDetail; adoId: number }) {
  const { item, attachments } = detail;

  if (item.assignee !== "human") {
    return null;
  }

  if (isOpen(item)) {
    return (
      <>
        <h2>{item.kind === "question" ? "Your answer" : "Close the task"}</h2>
        <CloseItemForm adoId={adoId} itemId={item.id} kind={item.kind} accept={ACCEPTED_EXTENSIONS.join(",")} />
      </>
    );
  }

  return (
    <>
      <h2>{item.kind === "question" ? "Answer" : "Outcome"}</h2>
      <p>{item.status}{item.resolution ? `: ${item.resolution}` : ""}</p>
      {attachments.length > 0 && (
        <ul>
          {attachments.map((entry) => <li key={entry.id}><a href={`/pbis/${adoId}/attachments/${entry.id}`}>{attachmentRef(entry.id)} {entry.fileName}</a></li>)}
        </ul>
      )}
    </>
  );
}
