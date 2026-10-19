import { ACCEPTED_EXTENSIONS } from "@powerloom/attachments";
import { attachmentRef, documentUrl, linkedDocumentKind, pbiLinkedUrls, readAdoSettings } from "@powerloom/core";
import Link from "next/link";
import { MarkdownBlock } from "@/components/MarkdownBlock";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import type { PbiDetail } from "@/lib/pbiDetail";
import { shortUrl } from "@/lib/shortUrl";
import { AttachmentForm } from "./AttachmentForm";
import { ChildItems } from "./ChildItems";
import { ConfluenceLinkForm } from "./ConfluenceLinkForm";
import { LoadFromConfluenceButton } from "./LoadFromConfluenceButton";
import { RemoveLinkButton } from "./RemoveLinkButton";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

// Who added the file: the user, or the worker fetching a linked document (refreshed when that document changes).
const ORIGINS: Record<string, string> = { upload: "you", ado: "ADO (linked)", confluence: "Confluence (linked)", agent: "agent's notes (linked)" };

const LINK_ADDED_BY: Record<string, string> = { user: "you", refinement: "refinement", research: "research", design: "design" };

// The PBI as Azure DevOps has it, with what the agents read on top: child items, linked documents, attachments.
export async function AdoTab({ detail }: { detail: PbiDetail }) {
  const { pbi } = detail;

  return (
    <div className="pbi-page-panels">
      <Panel title="Description"><TextBlock text={pbi.descriptionMd} /></Panel>
      <Panel title="Acceptance criteria"><TextBlock text={pbi.acceptanceCriteriaMd} /></Panel>
      {pbi.extraFieldsMd && <Panel title="More from Azure DevOps"><MarkdownBlock text={pbi.extraFieldsMd} /></Panel>}
      <Panel title="Child items" table={detail.children.length > 0}><ChildItems items={detail.children} ado={await readAdoSettings(getDb(), pbi.vault)} /></Panel>
      <Panel title="Linked documents"><LinkedDocuments detail={detail} /></Panel>
      <Panel title="Attachments"><Attachments detail={detail} /></Panel>
    </div>
  );
}

// Description and acceptance criteria are markdown (sync converts ADO's HTML).
function TextBlock({ text }: { text: string | null }) {
  return text ? <MarkdownBlock text={text} /> : <p className="empty">Empty in Azure DevOps.</p>;
}

function LinkedDocuments({ detail }: { detail: PbiDetail }) {
  const urls = pbiLinkedUrls(detail.pbi);

  if (urls.length === 0) {
    return <p className="empty">None in the description or acceptance criteria.</p>;
  }

  return (
    <div className="item-rows">
      {urls.map((url) => <LinkedDocument key={url} adoId={detail.pbi.adoId} url={url} provided={providedBy(detail, url)} />)}
    </div>
  );
}

// A missing Confluence page can be loaded right here (the worker fetches it); other documents are uploaded below. A web
// page without content is read by agents with web access, who save their notes on it (user decision 2026-10-14).
function LinkedDocument({ adoId, url, provided }: { adoId: number; url: string; provided: string[] }) {
  const link = <a href={url} target="_blank" rel="noreferrer" className="item-title" title={url}>{shortUrl(url)} ↗</a>;

  if (provided.length > 0) {
    return <div className="item-row"><span className="dot ok" />{link}<span className="item-state">content provided ({provided.join(", ")})</span></div>;
  }

  if (linkedDocumentKind(url) === "web") {
    return <div className="item-row"><span className="dot" />{link}<span className="item-state">read by agents with web access</span></div>;
  }

  return (
    <div className="item-row">
      <span className="dot warn" />{link}<span className="item-state text-warn">content missing for agents</span>
      {linkedDocumentKind(url) === "confluence" && <LoadFromConfluenceButton adoId={adoId} url={url} />}
    </div>
  );
}

function Attachments({ detail }: { detail: PbiDetail }) {
  return (
    <>
      {detail.attachments.length + detail.pbi.confluencePages.length === 0 ? <p className="empty">None.</p> : <AttachmentRows detail={detail} />}
      <div className="attachment-forms">
        <AttachmentForm adoId={detail.pbi.adoId} accept={ACCEPT} />
        <ConfluenceLinkForm adoId={detail.pbi.adoId} />
      </div>
      <p className="hint">PDF, Word (.docx), Excel (.xlsx), CSV, HTML (e.g. a saved Confluence page), Markdown or text are converted to text for the agents; images are stored only. Max 20 MB per file; several files at once, also pasted (Ctrl+V) or dropped.</p>
    </>
  );
}

// A compact list (user decision 2026-10-18): the file, where it came from and what it is the content of on a quiet
// line under it, its size, what the agents read, and when it came.
function AttachmentRows({ detail }: { detail: PbiDetail }) {
  return (
    <div className="item-rows">
      {detail.attachments.map((entry) => (
        <div key={entry.id} className="item-row file-row">
          <span className="id">{attachmentRef(entry.id)}</span>
          <span className="item-title">
            <a href={`/pbis/${detail.pbi.adoId}/attachments/${entry.id}`}>{entry.fileName}</a>
            <span className="file-meta">
              {ORIGINS[entry.origin]}{entry.sourceVersion ? ` v${entry.sourceVersion}` : ""}
              {entry.itemId && <> · for <Link href={`/pbis/${detail.pbi.adoId}/items/${entry.itemId}`}>{entry.itemId}</Link></>}
              {entry.sourceUrl && <> · content of <span title={entry.sourceUrl}>{shortUrl(entry.sourceUrl)}</span></>}
            </span>
          </span>
          <span className="item-state">{formatBytes(entry.sizeBytes)} · {entry.textChars === null ? "no text (image)" : `${entry.textChars} chars`} · <TimeAgo date={entry.createdAt} /></span>
        </div>
      ))}
      {detail.pbi.confluencePages.map((page) => (
        <div key={page.url} className="item-row file-row">
          <span className="id">link</span>
          <span className="item-title">
            <a href={page.url} target="_blank" rel="noreferrer">{page.title} ↗</a>
            <span className="file-meta">Confluence link, added by {LINK_ADDED_BY[page.by] ?? page.by}{page.why ? ` · ${page.why}` : ""}</span>
          </span>
          <span className="item-state">read with the Confluence tools</span>
          <RemoveLinkButton adoId={detail.pbi.adoId} url={page.url} />
        </div>
      ))}
    </div>
  );
}

function providedBy(detail: PbiDetail, url: string): string[] {
  return detail.attachments.filter((entry) => entry.sourceUrl !== null && documentUrl(entry.sourceUrl) === url).map((entry) => attachmentRef(entry.id));
}
