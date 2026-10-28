import { agentRun, localItem, refinement, vaultCapture, workItem } from "@powerloom/db";
import { and, eq, inArray } from "drizzle-orm";
import Link from "next/link";
import { NoteLink } from "@/components/NoteLink";
import { Panel } from "@/components/Panel";
import { getDb } from "@/lib/db";
import { itemPath } from "@/lib/items";

type RunRow = typeof agentRun.$inferSelect;

// What the run made, as status rows like the PBI page's items: the PBI note and refinement version, the items it
// created, and the notes the tech-writer wrote (its outputs that are no item). `producers` names the sub-session that
// made an output, when one did.
export async function RunOutputs({ run, producers = {} }: { run: RunRow; producers?: Record<string, string> }) {
  const ids = (run.outputs ?? []).filter((output) => !output.includes("refinement"));
  const db = getDb();
  const items = ids.length > 0 ? await db.select().from(localItem).where(inArray(localItem.id, ids)) : [];
  const [pbi] = run.pbiId ? await db.select().from(workItem).where(eq(workItem.adoId, run.pbiId)) : [];
  const [version] = run.pbiId ? await db.select().from(refinement).where(and(eq(refinement.pbiId, run.pbiId), eq(refinement.runId, run.id))) : [];
  const notes = ids.filter((output) => !items.some((item) => item.id === output));

  if (!version && items.length === 0 && notes.length === 0) {
    return <p className="hint">None.</p>;
  }

  return (
    <div className="item-rows">
      {pbi?.vaultPath && <div className="item-row"><span className="dot ok" /><NoteLink vault={pbi.vault} path={pbi.vaultPath} label={`PBI-${pbi.adoId} note`} /></div>}
      {version && pbi?.vaultPath && <div className="item-row"><span className="dot ok" /><NoteLink vault={pbi.vault} path={pbi.vaultPath.replace(/[^/]+$/, `PBI-${pbi.adoId}-refinement.md`)} label={`Refinement v${version.version}`} /></div>}
      {items.map((item) => (
        <div key={item.id} className="item-row">
          <span className="dot ok" />
          <Link href={itemPath(item)} className="id">{item.id}</Link>
          <span className="item-title" title={item.title}>{item.title}</span>
          <span className="item-state">{item.kind} · {item.status}{producedBy(producers, item.id)}</span>
        </div>
      ))}
      {notes.map((note) => <div key={note} className="item-row"><span className="dot ok" /><span className="item-title mono">{note}</span><span className="item-state">{producedBy(producers, note)}</span></div>)}
    </div>
  );
}

function producedBy(producers: Record<string, string>, output: string): string {
  return producers[output] ? ` · by ${producers[output]}` : "";
}

// VaultCapture results: created or appended drafts, or the module's reasons for rejecting.
export async function RunCaptures({ runId }: { runId: number }) {
  const captures = await getDb().select().from(vaultCapture).where(eq(vaultCapture.runId, runId));

  if (captures.length === 0) {
    return null;
  }

  return (
    <Panel title="Vault captures">
      <div className="item-rows">
        {captures.map((capture) => (
          <div key={capture.id} className="item-row">
            <span className={capture.status === "rejected" ? "dot error" : "dot ok"} />
            <span className="item-title">{capture.name}<span className="file-meta">{capture.filePath ?? ""}{capture.errors.length > 0 ? ` · ${capture.errors.join("; ")}` : ""}</span></span>
            <span className="item-state">{capture.status}</span>
          </div>
        ))}
      </div>
    </Panel>
  );
}
