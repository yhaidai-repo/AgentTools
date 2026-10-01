import { attachmentRef, pbiLinkedUrls, readAdoSettings, workItemUrl } from "@adoa/core";
import { ACCEPTED_EXTENSIONS } from "@adoa/attachments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { NoteLink } from "@/components/NoteLink";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { loadPbiDetail, type PbiDetail } from "@/lib/pbiDetail";
import { AttachmentForm } from "./AttachmentForm";
import { CloseItemForm } from "./CloseItemForm";

export const dynamic = "force-dynamic";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");
const OPEN_STATUSES = ["open", "in-progress"];

type ItemRow = PbiDetail["items"][number];

export default async function PbiPage({ params }: { params: Promise<{ adoId: string }> }) {
  const adoId = Number((await params).adoId);
  const detail = Number.isInteger(adoId) ? await loadPbiDetail(adoId) : null;

  if (!detail) {
    notFound();
  }

  const { pbi, items } = detail;
  const humanItems = items.filter((item) => item.assignee === "human");

  return (
    <>
      <h1>PBI-{pbi.adoId} · {pbi.title}</h1>
      <p><Link href="/pbis">← Backlog</Link></p>
      <Summary detail={detail} adoUrl={await adoUrl(pbi.adoId)} />
      <h2>Waiting for you</h2>
      <OpenItems adoId={pbi.adoId} items={humanItems.filter(isOpen)} />
      <h2>Linked documents</h2>
      <LinkedDocuments detail={detail} />
      <h2>Attachments</h2>
      <Attachments detail={detail} />
      <h2>Answered and closed</h2>
      <ClosedItems detail={detail} items={humanItems.filter((item) => !isOpen(item))} />
      <h2>Agent items</h2>
      <AgentItems items={items.filter((item) => item.assignee !== "human")} />
      <h2>Runs</h2>
      <Runs detail={detail} />
    </>
  );
}

function Summary({ detail, adoUrl }: { detail: PbiDetail; adoUrl: string | null }) {
  const { pbi } = detail;

  return (
    <div className="chips">
      <span className="chip">pipeline: {pbi.pipelineStatus}</span>
      <span className="chip">ADO: {pbi.adoState}</span>
      <span className="chip">sprint: {pbi.iterationPath ?? "–"}</span>
      <span className="chip">assigned: {pbi.assignedTo ?? "–"}</span>
      {adoUrl && <a className="chip" href={adoUrl} target="_blank" rel="noreferrer">open in ADO</a>}
      {pbi.vaultPath ? <span className="chip"><NoteLink path={pbi.vaultPath} label="open note" /></span> : <span className="chip">no note yet (prepare it in the Backlog)</span>}
    </div>
  );
}

function OpenItems({ adoId, items }: { adoId: number; items: ItemRow[] }) {
  if (items.length === 0) {
    return <p className="muted">Nothing open.</p>;
  }

  return (
    <div className="item-cards">
      {items.map((item) => (
        <section key={item.id} className="card">
          <h3>{item.id} · {item.kind === "question" ? "question" : "human task"}</h3>
          <p>{item.body ?? item.title}</p>
          <ItemContext item={item} />
          <CloseItemForm adoId={adoId} itemId={item.id} kind={item.kind} accept={ACCEPT} />
        </section>
      ))}
    </div>
  );
}

function ItemContext({ item }: { item: ItemRow }) {
  const data = (item.data ?? {}) as { why?: string; options?: string[] };

  return (
    <>
      {data.why && <p className="muted">Why: {data.why}</p>}
      {data.options && data.options.length > 0 && <p className="muted">Options: {data.options.join(" · ")}</p>}
    </>
  );
}

function LinkedDocuments({ detail }: { detail: PbiDetail }) {
  const urls = linkedUrls(detail);

  if (urls.length === 0) {
    return <p className="muted">None in the description or acceptance criteria.</p>;
  }

  return (
    <ul>
      {urls.map((url) => {
        const provided = detail.attachments.filter((entry) => entry.sourceUrl === url).map((entry) => attachmentRef(entry.id));

        return (
          <li key={url}>
            <a href={url} target="_blank" rel="noreferrer">{url}</a> · {provided.length > 0 ? <span className="result-ok">content provided ({provided.join(", ")})</span> : <span className="result-error">content missing for agents</span>}
          </li>
        );
      })}
    </ul>
  );
}

function Attachments({ detail }: { detail: PbiDetail }) {
  return (
    <>
      {detail.attachments.length === 0 ? <p className="muted">None.</p> : <AttachmentTable detail={detail} />}
      <AttachmentForm adoId={detail.pbi.adoId} linkedUrls={linkedUrls(detail)} accept={ACCEPT} />
      <p className="muted">PDF, Word (.docx), HTML (e.g. a saved Confluence page), Markdown or text are converted to text for the agents; images are stored only. Max 20 MB.</p>
    </>
  );
}

function AttachmentTable({ detail }: { detail: PbiDetail }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Id</th><th>File</th><th>For</th><th>Content of</th><th>Size</th><th>Agents read</th><th>Uploaded</th></tr>
        </thead>
        <tbody>
          {detail.attachments.map((entry) => (
            <tr key={entry.id}>
              <td>{attachmentRef(entry.id)}</td>
              <td><a href={`/pbis/${detail.pbi.adoId}/attachments/${entry.id}`}>{entry.fileName}</a></td>
              <td>{entry.itemId ?? "–"}</td>
              <td>{entry.sourceUrl ?? "–"}</td>
              <td>{formatBytes(entry.sizeBytes)}</td>
              <td>{entry.textChars === null ? "no text (image)" : `${entry.textChars} chars`}</td>
              <td><LocalTime date={entry.createdAt} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ClosedItems({ detail, items }: { detail: PbiDetail; items: ItemRow[] }) {
  if (items.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <ul>
      {items.map((item) => {
        const files = detail.attachments.filter((entry) => entry.itemId === item.id).map((entry) => attachmentRef(entry.id));

        return <li key={item.id}>{item.id} · {item.status} · {item.title}{item.resolution ? ` → ${item.resolution}` : ""}{files.length > 0 ? ` (${files.join(", ")})` : ""}</li>;
      })}
    </ul>
  );
}

function AgentItems({ items }: { items: ItemRow[] }) {
  if (items.length === 0) {
    return <p className="muted">None yet.</p>;
  }

  return (
    <ul>
      {items.map((item) => (
        <li key={item.id}>{item.vaultPath ? <NoteLink path={item.vaultPath} label={item.id} /> : item.id} · {item.kind} · {item.status} · {item.title}</li>
      ))}
    </ul>
  );
}

function Runs({ detail }: { detail: PbiDetail }) {
  if (detail.runs.length === 0) {
    return <p className="muted">None yet.</p>;
  }

  return (
    <ul>
      {detail.runs.map((run) => (
        <li key={run.id}><Link href={`/agents/runs/${run.id}`}>RUN-{run.id}</Link> · {run.stage} · {run.outcome} · <LocalTime date={run.startedAt} /></li>
      ))}
    </ul>
  );
}

function isOpen(item: ItemRow): boolean {
  return OPEN_STATUSES.includes(item.status);
}

function linkedUrls(detail: PbiDetail): string[] {
  return pbiLinkedUrls(detail.pbi);
}

async function adoUrl(adoId: number): Promise<string | null> {
  const ado = await readAdoSettings(getDb());

  return ado ? workItemUrl(ado, adoId) : null;
}
