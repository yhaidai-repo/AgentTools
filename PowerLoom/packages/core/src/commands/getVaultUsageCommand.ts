import { readUsageEvents } from "@powerloom/vault";
import { z } from "zod";
import type { Command } from "../models/Command";
import type { NoteUsage } from "../models/NoteUsage";
import type { VaultUsageSummary } from "../models/VaultUsageSummary";
import { periodStart } from "../periods";
import { listVaultNotes } from "../vaultPage/vaultNotes";
import { mountedVaultRoot } from "../vaultPage/vaultRoot";
import { ALL_NOTE_AGENTS, noteAgentChoices, isNoteUsed, noteUsage, useCount } from "../vaultPage/vaultUsage";
import { limitInput, periodInput, vaultInput } from "./inputs";

type GetVaultUsageInput = { vault: string; period: string; agent?: string | undefined; limit: number };

// The Vault page's Usage tab: the most used notes in the period and the notes nobody used, from VaultUsage's log
// (Claude Code and PowerLoom's agents), by one agent or all.
export const getVaultUsageCommand: Command<GetVaultUsageInput, VaultUsageSummary> = {
  name: "vault.usage",
  effect: "read",
  description: "How a docs vault's notes were used in the period, from VaultUsage's log: the most used notes (reads, searches and shell uses, most first) and the notes nobody used (longest unused first, never used before them). agent narrows to one agent of the log (claude-code, powerloom:<agent>) or PowerLoom for all of PowerLoom's agents.",
  input: z.object({
    vault: vaultInput,
    period: periodInput,
    agent: z.string().trim().min(1).optional().describe("An agent of the log (claude-code, powerloom:research, …) or PowerLoom for all of PowerLoom's; every agent when left out"),
    limit: limitInput(500, 100),
  }),
  async run(context, input) {
    const root = await mountedVaultRoot(input.vault, context.db);

    if (!root.ok) {
      return root;
    }

    const events = await readUsageEvents(root.value);
    const agents = noteAgentChoices(events);
    const agent = input.agent ?? ALL_NOTE_AGENTS;

    if (!agents.includes(agent)) {
      return { ok: false, error: `No usage by ${agent} in vault ${input.vault}; the log knows ${agents.join(", ")}.` };
    }

    const notes = await listVaultNotes(root.value);
    const since = await periodStart(context.db, input.period, input.vault);
    const usage = noteUsage(notes, events, since, agent);

    return { ok: true, value: { mostUsed: mostUsed(usage, input.limit), notUsed: notUsed(usage, input.limit) } };
  },
};

function mostUsed(usage: NoteUsage[], limit: number): VaultUsageSummary["mostUsed"] {
  const used = usage.filter(isNoteUsed).sort((a, b) => useCount(b) - useCount(a)).slice(0, limit);

  return used.map((entry) => ({ path: entry.path, title: entry.title, uses: useCount(entry), lastUsedAt: entry.lastUsed }));
}

function notUsed(usage: NoteUsage[], limit: number): VaultUsageSummary["notUsed"] {
  const unused = usage.filter((entry) => !isNoteUsed(entry)).sort((a, b) => (a.lastUsed?.getTime() ?? 0) - (b.lastUsed?.getTime() ?? 0)).slice(0, limit);

  return unused.map((entry) => ({ path: entry.path, title: entry.title, lastUsedAt: entry.lastUsed }));
}
