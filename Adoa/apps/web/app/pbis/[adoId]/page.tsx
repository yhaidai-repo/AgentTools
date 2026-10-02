import { attachmentRef, linkedDocumentKind, pbiLinkedUrls, readAdoSettings, workItemUrl } from "@adoa/core";
import { repo } from "@adoa/db";
import { eq } from "drizzle-orm";
import { ACCEPTED_EXTENSIONS } from "@adoa/attachments";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LocalTime } from "@/components/LocalTime";
import { NoteLink } from "@/components/NoteLink";
import { getDb } from "@/lib/db";
import { formatBytes } from "@/lib/format";
import { obsidianDocsLink } from "@/lib/obsidian";
import { loadPbiDetail, type PbiDetail } from "@/lib/pbiDetail";
import { AttachmentForm } from "./AttachmentForm";
import { isOpen } from "@/lib/items";
import { ItemList } from "./ItemList";
import { ConfluenceLinkForm } from "./ConfluenceLinkForm";
import { DeletePbiButton } from "./DeletePbiButton";
import { DesignSection } from "./DesignSection";
import { LoadFromConfluenceButton } from "./LoadFromConfluenceButton";
import { RemoveLinkButton } from "./RemoveLinkButton";
import { PbiReposForm } from "./PbiReposForm";
import { PbiSkills } from "./PbiSkills";

export const dynamic = "force-dynamic";

const ACCEPT = ACCEPTED_EXTENSIONS.join(",");

type DraftRow = PbiDetail["drafts"][number];

// Every state but merged (and rejected, which is a human task instead) blocks the other agents.
const DRAFT_STATES: Record<string, string> = {
  pending: "not written yet: blocks the other agents",
  created: "in draft/, waiting to be verified and merged: blocks the other agents",
  appended: "in draft/, waiting to be verified and merged: blocks the other agents",
  merged: "merged into the docs vault",
};

export default async function PbiPage({ params }: { params: Promise<{ adoId: string }> }) {
  const adoId = Number((await params).adoId);
  const detail = Number.isInteger(adoId) ? await loadPbiDetail(adoId) : null;

  if (!detail) {
    notFound();
  }

  const { pbi, items } = detail;

  return (
    <>
      <h1>PBI-{pbi.adoId} · {pbi.title}</h1>
      <p className="actions"><Link href="/pbis">← Backlog</Link> <DeletePbiButton adoId={pbi.adoId} /></p>
      <Summary detail={detail} adoUrl={await adoUrl(pbi.adoId)} />
      <Blockers detail={detail} />
      <h2>Description</h2>
      <TextBlock text={pbi.descriptionMd} />
      <h2>Acceptance criteria</h2>
      <TextBlock text={pbi.acceptanceCriteriaMd} />
      <h2>Refinement</h2>
      <Refinement detail={detail} />
      <h2>Design</h2>
      <DesignSection design={detail.design} />
      <h2>Repos</h2>
      <Repos detail={detail} />
      <h2>Skills for later agents</h2>
      <PbiSkills adoId={pbi.adoId} skills={pbi.skills} editedAt={pbi.skillsEditedAt} />
      <h2>Questions</h2>
      <ItemList items={items.filter((item) => item.kind === "question")} empty="None." />
      <h2>Human tasks</h2>
      <ItemList items={items.filter((item) => item.kind === "human")} empty="None." />
      <h2>Findings</h2>
      <ItemList items={items.filter((item) => item.kind === "finding")} empty="None." />
      <h2>Agent tasks</h2>
      <ItemList
        items={items.filter((item) => item.assignee !== "human" && item.kind !== "research-result")}
        results={items.filter((item) => item.kind === "research-result")}
        empty="None yet."
      />
      <h2>Vault drafts</h2>
      <Drafts detail={detail} />
      <h2>Linked documents</h2>
      <LinkedDocuments detail={detail} />
      <h2>Attachments</h2>
      <Attachments detail={detail} />
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

// What the user must do, and what the agents' tasks are waiting for (the dispatcher's last check).
function Blockers({ detail }: { detail: PbiDetail }) {
  // Findings wait for the user's review but don't hold the agents back (the dispatcher skips them too).
  const open = detail.items.filter((item) => isOpen(item) && item.kind !== "finding");
  const forYou = open.filter((item) => item.assignee === "human");
  const forAgents = open.filter((item) => item.assignee !== "human");
  const pendingDrafts = detail.drafts.filter(isUnmerged);

  if (open.length === 0 && pendingDrafts.length === 0) {
    return <p className="result-ok">No blockers: agents may work on this PBI.</p>;
  }

  return (
    <div className="card">
      {forYou.length > 0 && <p className="result-error">Needs your action: {forYou.length} open {forYou.length === 1 ? "item" : "items"}. Agents don't work on this PBI until you close them.</p>}
      {forAgents.length > 0 && <p className="muted">Agent tasks: {forAgents.map((item) => `${item.id} (${item.assignee.replace("agent:", "")}, ${item.status}${item.heldBy.length > 0 ? `, held: ${item.heldBy.join("; ")}` : ""})`).join(" · ")}</p>}
      {pendingDrafts.length > 0 && <p className="muted">Vault drafts not merged yet: {pendingDrafts.map((draft) => draft.name).join(", ")}. Until they are verified and moved out of draft/, only the agent that captured them may work.</p>}
    </div>
  );
}

// Facts agents captured for the docs vault (draft/ notes for a person to verify and merge).
function Drafts({ detail }: { detail: PbiDetail }) {
  if (detail.drafts.length === 0) {
    return <p className="muted">None.</p>;
  }

  return (
    <ul>
      {detail.drafts.map((draft) => (
        <li key={draft.id} className={draft.status === "merged" ? undefined : "result-error"}>
          <DraftName draft={draft} /> · {draftState(draft)} · <Link href={`/agents/runs/${draft.runId}`}>RUN-{draft.runId}</Link>
        </li>
      ))}
    </ul>
  );
}

function DraftName({ draft }: { draft: DraftRow }) {
  // A merged draft is gone from draft/, so only unmerged ones get a link.
  const href = draft.filePath && draft.status !== "merged" ? obsidianDocsLink(draft.filePath) : null;

  return href ? <a href={href}>{draft.name}</a> : <span>{draft.name}</span>;
}

function isUnmerged(draft: DraftRow): boolean {
  return ["pending", "created", "appended"].includes(draft.status);
}

function draftState(draft: DraftRow): string {
  return DRAFT_STATES[draft.status] ?? `rejected: ${draft.errors.join("; ")} (handed to you as a human task)`;
}

// What research and design clone: repos the vault documents or you confirmed; refinement's guesses wait for you.
async function Repos({ detail }: { detail: PbiDetail }) {
  const catalog = await getDb().select({ name: repo.name }).from(repo).where(eq(repo.excluded, false)).orderBy(repo.name);
  const fromRefinement = (detail.refinement?.repos ?? []).map((choice) => ({ name: choice.name, source: "refinement", questionId: null }));
  const repos = detail.repos.length > 0 ? detail.repos : fromRefinement;

  return (
    <>
      {/* Keyed by the saved list, so the form starts over from what was saved. */}
      <PbiReposForm key={JSON.stringify(repos)} adoId={detail.pbi.adoId} repos={repos} catalog={catalog.map((row) => row.name)} />
    </>
  );
}

function TextBlock({ text }: { text: string | null }) {
  return text ? <div className="text-block">{text}</div> : <p className="muted">Empty in Azure DevOps.</p>;
}

function Refinement({ detail }: { detail: PbiDetail }) {
  if (!detail.refinement) {
    return <p className="muted">Not refined yet.</p>;
  }

  return <p>{detail.refinement.summary} <span className="muted">(v{detail.refinement.version})</span></p>;
}

function LinkedDocuments({ detail }: { detail: PbiDetail }) {
  const urls = pbiLinkedUrls(detail.pbi);

  if (urls.length === 0) {
    return <p className="muted">None in the description or acceptance criteria.</p>;
  }

  return (
    <ul>
      {urls.map((url) => <LinkedDocument key={url} adoId={detail.pbi.adoId} url={url} provided={providedBy(detail, url)} />)}
    </ul>
  );
}

// A missing Confluence page can be loaded right here (the worker fetches it); other documents are uploaded below.
function LinkedDocument({ adoId, url, provided }: { adoId: number; url: string; provided: string[] }) {
  if (provided.length > 0) {
    return <li><a href={url} target="_blank" rel="noreferrer">{url}</a> · <span className="result-ok">content provided ({provided.join(", ")})</span></li>;
  }

  return (
    <li>
      <a href={url} target="_blank" rel="noreferrer">{url}</a> · <span className="result-error">content missing for agents</span>
      {linkedDocumentKind(url) === "confluence" && <> <LoadFromConfluenceButton adoId={adoId} url={url} /></>}
    </li>
  );
}

function Attachments({ detail }: { detail: PbiDetail }) {
  return (
    <>
      {detail.attachments.length + detail.pbi.confluencePages.length === 0 ? <p className="muted">None.</p> : <AttachmentTable detail={detail} />}
      <AttachmentForm adoId={detail.pbi.adoId} accept={ACCEPT} />
      <ConfluenceLinkForm adoId={detail.pbi.adoId} />
      <p className="muted">PDF, Word (.docx), HTML (e.g. a saved Confluence page), Markdown or text are converted to text for the agents; images are stored only. Max 20 MB.</p>
    </>
  );
}

// Who added the file: the user, or the worker fetching a linked document (refreshed when that document changes).
const ORIGINS: Record<string, string> = { upload: "you", ado: "ADO (linked)", confluence: "Confluence (linked)" };

function AttachmentTable({ detail }: { detail: PbiDetail }) {
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr><th>Id</th><th>File</th><th>For</th><th>Content of</th><th>From</th><th>Size</th><th>Agents read</th><th>Added</th><th /></tr>
        </thead>
        <tbody>
          {detail.attachments.map((entry) => (
            <tr key={entry.id}>
              <td>{attachmentRef(entry.id)}</td>
              <td><a href={`/pbis/${detail.pbi.adoId}/attachments/${entry.id}`}>{entry.fileName}</a></td>
              <td>{entry.itemId ? <Link href={`/pbis/${detail.pbi.adoId}/items/${entry.itemId}`}>{entry.itemId}</Link> : "–"}</td>
              <td>{entry.sourceUrl ?? "–"}</td>
              <td>{ORIGINS[entry.origin]}{entry.sourceVersion ? ` v${entry.sourceVersion}` : ""}</td>
              <td>{formatBytes(entry.sizeBytes)}</td>
              <td>{entry.textChars === null ? "no text (image)" : `${entry.textChars} chars`}</td>
              <td><LocalTime date={entry.createdAt} /></td>
              <td />
            </tr>
          ))}
          {detail.pbi.confluencePages.map((page) => <ConfluenceLinkRow key={page.url} adoId={detail.pbi.adoId} page={page} />)}
        </tbody>
      </table>
    </div>
  );
}

const LINK_ADDED_BY: Record<string, string> = { user: "you", refinement: "refinement", research: "research", design: "design" };

// A Confluence page as a link (not fetched): agents with the Confluence tools open it; the reason shows under the title.
function ConfluenceLinkRow({ adoId, page }: { adoId: number; page: PbiDetail["pbi"]["confluencePages"][number] }) {
  return (
    <tr>
      <td>link</td>
      <td>
        <a href={page.url} target="_blank" rel="noreferrer">{page.title}</a>
        {page.why && <div className="muted">{page.why}</div>}
      </td>
      <td>–</td>
      <td>–</td>
      <td>Confluence link ({LINK_ADDED_BY[page.by] ?? page.by})</td>
      <td>–</td>
      <td>as a link (Confluence tools)</td>
      <td>–</td>
      <td><RemoveLinkButton adoId={adoId} url={page.url} /></td>
    </tr>
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

function providedBy(detail: PbiDetail, url: string): string[] {
  return detail.attachments.filter((entry) => entry.sourceUrl === url).map((entry) => attachmentRef(entry.id));
}

async function adoUrl(adoId: number): Promise<string | null> {
  const ado = await readAdoSettings(getDb());

  return ado ? workItemUrl(ado, adoId) : null;
}
