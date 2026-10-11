import Link from "next/link";
import { LocalTime } from "@/components/LocalTime";
import { DEFAULT_RANGE, RANGES, rangeOptions, rangeStart } from "@/lib/ranges";
import { getDb } from "@/lib/db";
import { withWriteActions } from "@/lib/vaultNoteWrites";
import { listVaultNotes, notesWrittenByPowerLoom } from "@/lib/vaultNotes";
import { readUsageEvents } from "@powerloom/vault";
import { ALL_AGENTS, agentChoices, isUsed, noteUsage, useCount } from "@/lib/vaultUsage";
import type { PowerLoomNote } from "@/models/PowerLoomNote";
import type { NoteUsage } from "@/models/NoteUsage";
import { DocLink } from "./DocLink";
import { VaultFilters } from "./VaultFilters";

const MOST_USED = 20;
// The unused notes are most of a vault, so the table shows the first ones until asked for all (user decision 2026-10-05).
const NOT_USED = 20;
const SHOW_ALL = "all";

type UsageParams = { range?: string; agent?: string; unused?: string };

// What the tech-writer wrote, the most used notes and the notes nobody used in the period, from VaultUsage's log
// (Claude Code and PowerLoom's agents).
export async function UsageTab({ root, vault, params }: { root: string; vault: string; params: UsageParams }) {
  // The period is one choice across pages (Agents, Runs, Tasks, Vault): the same options, default and remembered value.
  const range = params.range && RANGES[params.range] ? params.range : DEFAULT_RANGE;
  const notes = await listVaultNotes(root);
  const events = await readUsageEvents(root);
  const agents = agentChoices(events);
  // The log is appended to (the backfill added older PowerLoom reads at its end), so its first line isn't the oldest.
  const loggedSince = events.reduce<Date | null>((oldest, event) => (oldest && oldest < event.at ? oldest : event.at), null);
  const agent = agents.find((choice) => choice === params.agent) ?? ALL_AGENTS;
  const since = rangeStart(range);
  const usage = noteUsage(notes, events, since, agent);
  const writtenByPowerLoom = await withWriteActions(getDb(), vault, notesWrittenByPowerLoom(notes, since));
  const used = usage.filter(isUsed).sort((a, b) => useCount(b) - useCount(a)).slice(0, MOST_USED);
  const unused = usage.filter((entry) => !isUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0));
  const showAllUnused = params.unused === SHOW_ALL;

  return (
    <>
      <p className="muted">Vault <code>{vault}</code>: {notes.length} notes, {events.length} usage events; usage logged since {loggedSince ? <LocalTime date={loggedSince} /> : "–"}.</p>
      <VaultFilters key={`${range}-${agent}`} range={range} agent={agent} ranges={rangeOptions()} agents={agents} />
      <h2>Written by PowerLoom in the period ({writtenByPowerLoom.length})</h2>
      <PowerLoomNotes vault={vault} notes={writtenByPowerLoom} />
      <h2>Usage</h2>
      <p className="muted">By the chosen agent; the agent filter doesn&apos;t apply to the notes PowerLoom wrote.</p>
      <h3>Most used ({used.length})</h3>
      <MostUsed vault={vault} rows={used} />
      <h3>Not used in the period ({unused.length})</h3>
      <NotUsed vault={vault} rows={showAllUnused ? unused : unused.slice(0, NOT_USED)} />
      {!showAllUnused && unused.length > NOT_USED && (
        <p className="muted">
          The first {NOT_USED} of {unused.length}. <Link href={`/vault?${new URLSearchParams({ tab: "usage", range, agent, unused: SHOW_ALL })}`}>Show all</Link>
        </p>
      )}
    </>
  );
}

function PowerLoomNotes({ vault, notes }: { vault: string; notes: PowerLoomNote[] }) {
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
              <td><DocLink vault={vault} path={note.path} /></td>
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

// Created or updated by the run in the row; an update of a note PowerLoom created earlier names that run.
function NoteChange({ note }: { note: PowerLoomNote }) {
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

function MostUsed({ vault, rows }: { vault: string; rows: NoteUsage[] }) {
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
              <td><DocLink vault={vault} path={row.path} /></td>
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

function NotUsed({ vault, rows }: { vault: string; rows: NoteUsage[] }) {
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
              <td><DocLink vault={vault} path={row.path} /></td>
              <td>{row.title}</td>
              <td>{row.lastUsed ? <LocalTime date={row.lastUsed} /> : <span className="muted">never</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
