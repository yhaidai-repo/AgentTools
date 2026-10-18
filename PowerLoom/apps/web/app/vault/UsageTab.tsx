import type { ReactNode } from "react";
import { StatTile } from "@/components/StatTile";
import { TimeAgo } from "@/components/TimeAgo";
import { getDb } from "@/lib/db";
import { periodStart } from "@/lib/periodStart";
import { periodOf } from "@/lib/ranges";
import { withWriteActions } from "@/lib/vaultNoteWrites";
import { listVaultNotes, notesWrittenByPowerLoom } from "@/lib/vaultNotes";
import { ALL_AGENTS, agentChoices, isUsed, noteUsage, useCount } from "@/lib/vaultUsage";
import { readUsageEvents } from "@powerloom/vault";
import { MostUsedPanel } from "./MostUsedPanel";
import { NotUsedPanel } from "./NotUsedPanel";
import { UsageFilters } from "./UsageFilters";
import { WrittenNotesPanel } from "./WrittenNotesPanel";

const MOST_USED = 20;
const SHOW_ALL = "all";

type UsageParams = { range?: string; agent?: string; unused?: string; page?: string; size?: string };

// What the tech-writer wrote, the most used notes and the notes nobody used in the period, from VaultUsage's log
// (Claude Code and PowerLoom's agents); four numbers on top (user decision 2026-10-18).
export async function UsageTab({ root, vault, params, tabs }: { root: string; vault: string; params: UsageParams; tabs: ReactNode }) {
  // The period is one choice across pages (Agents, Runs, Tasks, Vault): the same options, default and remembered value.
  const range = periodOf(params.range);
  const notes = await listVaultNotes(root);
  const events = await readUsageEvents(root);
  const agents = agentChoices(events);
  // The log is appended to (the backfill added older PowerLoom reads at its end), so its first line isn't the oldest.
  const loggedSince = events.reduce<Date | null>((oldest, event) => (oldest && oldest < event.at ? oldest : event.at), null);
  const agent = agents.find((choice) => choice === params.agent) ?? ALL_AGENTS;
  const since = await periodStart(range, vault);
  const usage = noteUsage(notes, events, since, agent);
  const written = await withWriteActions(getDb(), vault, notesWrittenByPowerLoom(notes, since));
  const used = usage.filter(isUsed).sort((a, b) => useCount(b) - useCount(a)).slice(0, MOST_USED);
  const unused = usage.filter((entry) => !isUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0));
  const created = written.filter((note) => note.action === "created").length;
  const keep = { tab: "usage", range, agent };

  return (
    <>
      <div className="tab-bar">
        {tabs}
        <UsageFilters range={range} agent={agent} agents={agents} />
      </div>
      <div className="band">
        <StatTile label="Notes" value={String(notes.length)} />
        <StatTile label="Written by PowerLoom" value={String(written.length)} note={`${created} new · ${written.length - created} updated`} />
        <StatTile label="Usage events" value={String(events.length)} note={loggedSince ? <>logged since <TimeAgo date={loggedSince} /></> : "none logged yet"} />
        <StatTile label="Not used" value={String(unused.length)} note="in the period" />
      </div>
      <WrittenNotesPanel vault={vault} notes={written} page={Number(params.page) || 1} size={Number(params.size) || 0} keep={keep} />
      <MostUsedPanel vault={vault} rows={used} palette={agents} agent={agent} />
      <NotUsedPanel vault={vault} rows={unused} showAll={params.unused === SHOW_ALL} keep={keep} />
    </>
  );
}
