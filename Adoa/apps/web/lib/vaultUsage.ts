import { isUse, type VaultUsageEvent } from "@adoa/vault";
import type { NoteUsage } from "@/models/NoteUsage";
import type { VaultNote } from "@/models/VaultNote";

// The log reader and what counts as use live in @adoa/vault, shared with the vault review.
const ADOA_PREFIX = "adoa:";

export const ALL_AGENTS = "all";
const ALL_ADOA = "adoa";

// Agents in the log for the filter: Claude Code and each adoa agent, plus "adoa" for all of adoa's together.
export function agentChoices(events: VaultUsageEvent[]): string[] {
  const agents = [...new Set(events.map((event) => event.agent))].sort();
  const hasAdoa = agents.some((agent) => agent.startsWith(ADOA_PREFIX));

  return [ALL_AGENTS, ...(hasAdoa ? [ALL_ADOA] : []), ...agents];
}

// Each note's use in the period by the chosen agent; "used" = read, search or shell. lastUsed looks at the whole log, so an
// unused note shows when it was last used, if ever.
export function noteUsage(notes: VaultNote[], events: VaultUsageEvent[], since: Date, agent: string): NoteUsage[] {
  const byAgent = events.filter((event) => matchesAgent(event.agent, agent));
  const inPeriod = byAgent.filter((event) => event.at >= since);

  return notes.map((note) => usageOf(note, inPeriod.filter((event) => event.file === note.path), byAgent.filter((event) => event.file === note.path)));
}

export function isUsed(usage: NoteUsage): boolean {
  return useCount(usage) > 0;
}

export function useCount(usage: NoteUsage): number {
  return usage.reads + usage.searches + usage.shell;
}

function usageOf(note: VaultNote, inPeriod: VaultUsageEvent[], ever: VaultUsageEvent[]): NoteUsage {
  const uses = ever.filter(isUse);
  const lastUsed = uses.reduce<Date | null>((latest, event) => (latest && latest > event.at ? latest : event.at), null);

  return {
    path: note.path,
    title: note.title,
    reads: inPeriod.filter((event) => event.kind === "read").length,
    searches: inPeriod.filter((event) => event.kind === "search").length,
    shell: inPeriod.filter((event) => event.kind === "shell").length,
    writes: inPeriod.filter((event) => event.kind === "write").length,
    agents: [...new Set(inPeriod.filter(isUse).map((event) => event.agent))].sort(),
    lastUsed,
  };
}

function matchesAgent(eventAgent: string, agent: string): boolean {
  if (agent === ALL_AGENTS) {
    return true;
  }

  return agent === ALL_ADOA ? eventAgent.startsWith(ADOA_PREFIX) : eventAgent === agent;
}
