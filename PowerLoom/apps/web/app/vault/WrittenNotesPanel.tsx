import Link from "next/link";
import { Pager } from "@/components/Pager";
import { Panel } from "@/components/Panel";
import { TimeAgo } from "@/components/TimeAgo";
import { vaultUrl } from "@/lib/vaultUrl";
import type { PowerLoomNote } from "@/models/PowerLoomNote";
import { DocLink } from "./DocLink";

const PAGE_SIZES = [25, 50, 100];

interface WrittenNotesPanelProps {
  vault: string;
  notes: PowerLoomNote[];
  page: number;
  size: number;
  keep: Record<string, string>;
}

// The notes PowerLoom wrote in the period, in four columns that fit (user, 2026-10-18): the title with its path under
// it, what the run did, the run, and when; paged like every list.
export function WrittenNotesPanel({ vault, notes, page, size, keep }: WrittenNotesPanelProps) {
  const pageSize = PAGE_SIZES.includes(size) ? size : PAGE_SIZES[0];
  const pages = Math.max(Math.ceil(notes.length / pageSize), 1);
  const shown = Math.min(Math.max(page, 1), pages);

  return (
    <Panel title={<span>Written by PowerLoom <small>in the period · not filtered by agent</small></span>} aside={<small>{notes.length}</small>} table>
      {notes.length === 0 ? <p className="panel-body hint">The tech-writer wrote no note in the period.</p> : <NotesTable vault={vault} notes={notes.slice((shown - 1) * pageSize, shown * pageSize)} />}
      {notes.length > pageSize && <div className="panel-body"><Pager page={shown} size={pageSize} sizes={PAGE_SIZES} pages={pages} total={notes.length} noun="notes" hrefOf={(change) => vaultUrl({ ...keep, page: change.page, size: change.size ?? pageSize })} /></div>}
    </Panel>
  );
}

function NotesTable({ vault, notes }: { vault: string; notes: PowerLoomNote[] }) {
  return (
    <table className="data-table vault-table">
      <thead>
        <tr><th>Note</th><th className="col-change">Change</th><th className="col-run">Run</th><th className="col-when num">When</th></tr>
      </thead>
      <tbody>
        {notes.map((note) => (
          <tr key={note.path}>
            <td className="title"><DocLink vault={vault} path={note.path}>{note.title}</DocLink><span className="note-path">{note.path}</span></td>
            <td className="col-change"><NoteChange note={note} /></td>
            <td className="col-run">{note.runId ? <Link href={`/agents/runs/${note.runId}`}>RUN-{note.runId}</Link> : "–"}</td>
            <td className="col-when num"><TimeAgo date={note.date} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// A new note is a filled teal pill with a plus, an update a dashed violet one with a pencil (user, 2026-10-18: the two
// looked the same); an update of a note PowerLoom created earlier names that run.
function NoteChange({ note }: { note: PowerLoomNote }) {
  if (!note.action) {
    return <span className="muted">not recorded</span>;
  }

  const createdEarlier = note.action === "updated" && note.createdByRunId !== null && note.createdByRunId !== note.runId;

  return (
    <>
      <span className={`note-change ${note.action}`}>{note.action}</span>
      {createdEarlier && <span className="note-created-in">created in <Link href={`/agents/runs/${note.createdByRunId}`}>RUN-{note.createdByRunId}</Link></span>}
    </>
  );
}
