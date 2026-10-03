import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { RememberFilters } from "@/components/RememberFilters";
import { obsidianDocsLink } from "@/lib/obsidian";
import { DEFAULT_RANGE, RANGES, rangeOptions, rangeStart } from "@/lib/ranges";
import { rememberedParams } from "@/lib/rememberedFilters";
import { getDb } from "@/lib/db";
import { withWriteActions } from "@/lib/vaultNoteWrites";
import { docsRoot, listVaultNotes, notesWrittenByAdoa } from "@/lib/vaultNotes";
import { ALL_AGENTS, agentChoices, isUsed, noteUsage, readUsageEvents, useCount } from "@/lib/vaultUsage";
import type { AdoaNote } from "@/models/AdoaNote";
import type { NoteUsage } from "@/models/NoteUsage";
import { VaultFilters } from "./VaultFilters";

export const dynamic = "force-dynamic";

const MOST_USED = 20;

type SearchParams = Promise<{ range?: string; agent?: string }>;

// The docs vault adoa's agents use (user decision 2026-10-02): what the tech-writer wrote, the most used notes and the
// notes nobody used in the period, from VaultUsage's log (Claude Code and adoa's agents).
export default async function VaultPage({ searchParams }: { searchParams: SearchParams }) {
  const root = docsRoot();

  if (!root) {
    return <><h1>Vault</h1><p className="result-error">The docs vault isn&apos;t mounted for the web (DOCS_ROOT).</p></>;
  }

  const params = await rememberedParams("/vault", await searchParams);
  // The period is one choice across pages (Agents, Runs, Tasks, Vault): the same options, default and remembered value.
  const range = params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE;
  const notes = await listVaultNotes(root);
  const events = await readUsageEvents(root);
  const agents = agentChoices(events);
  // The log is appended to (the backfill added older adoa reads at its end), so its first line isn't the oldest.
  const loggedSince = events.reduce<Date | null>((oldest, event) => (oldest && oldest < event.at ? oldest : event.at), null);
  const agent = agents.find((choice) => choice === params.agent) ?? ALL_AGENTS;
  const since = rangeStart(range);
  const usage = noteUsage(notes, events, since, agent);
  const writtenByAdoa = await withWriteActions(getDb(), notesWrittenByAdoa(notes, since));
  const used = usage.filter(isUsed).sort((a, b) => useCount(b) - useCount(a)).slice(0, MOST_USED);
  const unused = usage.filter((entry) => !isUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0));

  return (
    <>
      <h1>Vault</h1>
      <RememberFilters />
      <p className="muted">Docs vault <code>{process.env.DOCS_VAULT_NAME ?? root}</code>: {notes.length} notes, {events.length} usage events; usage logged since {loggedSince ? <LocalTime date={loggedSince} /> : "–"}.</p>
      <VaultFilters key={`${range}-${agent}`} range={range} agent={agent} ranges={rangeOptions()} agents={agents} />
      <h2>Written by adoa in the period ({writtenByAdoa.length})</h2>
      <AdoaNotes notes={writtenByAdoa} />
      <h2>Usage</h2>
      <p className="muted">By the chosen agent; the agent filter doesn&apos;t apply to the notes adoa wrote.</p>
      <h3>Most used ({used.length})</h3>
      <MostUsed rows={used} />
      <h3>Not used in the period ({unused.length})</h3>
      <NotUsed rows={unused} />
    </>
  );
}

function AdoaNotes({ notes }: { notes: AdoaNote[] }) {
  if (notes.length === 0) {
    return <p className="muted">The tech-writer wrote no note in the period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Title</th>
            <th>Change</th>
            <th>Date</th>
            <th>Run</th>
          </tr>
        </thead>
        <tbody>
          {notes.map((note) => (
            <tr key={note.path}>
              <td><DocLink path={note.path} /></td>
              <td>{note.title}</td>
              <td><NoteChange note={note} /></td>
              <td>{note.date}</td>
              <td>{note.runId ? <Link href={`/agents/runs/${note.runId}`}>RUN-{note.runId}</Link> : "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Created or updated by the run in the row; an update of a note adoa created earlier names that run.
function NoteChange({ note }: { note: AdoaNote }) {
  if (!note.action) {
    return <span className="muted">not recorded</span>;
  }

  const createdEarlier = note.action === "updated" && note.createdByRunId !== null && note.createdByRunId !== note.runId;

  return (
    <>
      <span className={note.action === "created" ? "chip result-ok" : "chip"}>{note.action}</span>
      {createdEarlier && <span className="muted"> · created in <Link href={`/agents/runs/${note.createdByRunId}`}>RUN-{note.createdByRunId}</Link></span>}
    </>
  );
}

function MostUsed({ rows }: { rows: NoteUsage[] }) {
  if (rows.length === 0) {
    return <p className="muted">No note was used in the period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Reads</th>
            <th>Searches</th>
            <th title="Named in a shell command: Claude Code's usual way to read a note (sometimes only a mention)">Shell</th>
            <th>Writes</th>
            <th>Agents</th>
            <th>Last used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path}>
              <td><DocLink path={row.path} /></td>
              <td>{row.reads}</td>
              <td>{row.searches}</td>
              <td>{row.shell}</td>
              <td>{row.writes}</td>
              <td>{row.agents.join(", ")}</td>
              <td><LocalTime date={row.lastUsed} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function NotUsed({ rows }: { rows: NoteUsage[] }) {
  if (rows.length === 0) {
    return <p className="muted">Every note was used in the period.</p>;
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Title</th>
            <th>Last used</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.path}>
              <td><DocLink path={row.path} /></td>
              <td>{row.title}</td>
              <td>{row.lastUsed ? <LocalTime date={row.lastUsed} /> : <span className="muted">never</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// Opens the note in Obsidian; the plain path when DOCS_VAULT_NAME isn't set.
function DocLink({ path }: { path: string }) {
  const href = obsidianDocsLink(path);

  return href ? <a href={href}>{path}</a> : <span>{path}</span>;
}
