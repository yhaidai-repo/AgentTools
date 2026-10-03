import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { NoteUsage } from "@/models/NoteUsage";
import type { VaultNote } from "@/models/VaultNote";
import type { VaultUsageEvent } from "@/models/VaultUsageEvent";

// VaultUsage's log contract (its README): one JSON object per line in <vault>/.usage/usage.jsonl. Its PowerShell report
// isn't in the containers, so the page reads the log itself.
const LOG_FILE = ".usage/usage.jsonl";
// Claude Code reads the vault mostly through shell commands (cat, sed, grep), logged as `shell` (user decision 2026-10-02:
// they count, like in VaultUsage's own report; a few are only mentions). Writes alone don't.
const USE_KINDS = ["read", "search", "shell"];
const ADOA_PREFIX = "adoa:";

export const ALL_AGENTS = "all";
export const ALL_ADOA = "adoa";

export async function readUsageEvents(root: string): Promise<VaultUsageEvent[]> {
  const text = await readFile(join(root, LOG_FILE), "utf8").catch(() => "");

  return text.split("\n").filter((line) => line.trim()).map(parseLine).filter((event): event is VaultUsageEvent => event !== null);
}

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
  const uses = ever.filter((event) => USE_KINDS.includes(event.kind));
  const lastUsed = uses.reduce<Date | null>((latest, event) => (latest && latest > event.at ? latest : event.at), null);

  return {
    path: note.path,
    title: note.title,
    reads: inPeriod.filter((event) => event.kind === "read").length,
    searches: inPeriod.filter((event) => event.kind === "search").length,
    shell: inPeriod.filter((event) => event.kind === "shell").length,
    writes: inPeriod.filter((event) => event.kind === "write").length,
    agents: [...new Set(inPeriod.filter((event) => USE_KINDS.includes(event.kind)).map((event) => event.agent))].sort(),
    lastUsed,
  };
}

function matchesAgent(eventAgent: string, agent: string): boolean {
  if (agent === ALL_AGENTS) {
    return true;
  }

  return agent === ALL_ADOA ? eventAgent.startsWith(ADOA_PREFIX) : eventAgent === agent;
}

function parseLine(line: string): VaultUsageEvent | null {
  try {
    const raw = JSON.parse(line) as { ts?: string; file?: string; kind?: VaultUsageEvent["kind"]; agent?: string };

    return raw.ts && raw.file && raw.kind ? { at: new Date(raw.ts), file: raw.file, kind: raw.kind, agent: raw.agent ?? "unknown" } : null;
  } catch {
    return null;
  }
}
