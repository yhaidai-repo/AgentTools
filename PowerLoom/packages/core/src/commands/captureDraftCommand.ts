import { z } from "zod";
import type { Command } from "../models/Command";
import type { DraftOutcome } from "../models/DraftOutcome";
import { vaultInput } from "./inputs";

const factsInput = z.array(z.string().trim().min(1));

// vault_capture for a chat without file access (stage 5, MCPQ-008): the agents' draft fields, written at once.
export const captureDraftCommand: Command<{ vault: string; project: string; name: string; title: string; target: string; captured: string[]; assumptions: string[]; toFill: string[] }, DraftOutcome> = {
  name: "vault.capture",
  description: "Save durable facts you verified with the user and the docs vault lacks as an unverified draft in the vault's draft/ folder, for a person to verify and merge (the same draft an agent's vault_capture writes). The vault rules (its AGENTS.md) are enforced: name kebab-case starting with the project key, target a [[note]] or a folder, one fact per bullet, [[note]] links instead of .md paths; the same name again adds bullets to that draft. Show the user the draft first and save it after their yes; a rejected draft answers what to fix.",
  input: z.object({
    vault: vaultInput,
    project: z.string().trim().min(1).describe("The docs vault's project key (a top-level folder with a <key>-index note), e.g. pvs"),
    name: z.string().trim().min(1).describe("The note name: kebab-case, starting with the project key, e.g. pvs-medicaid-recipient-facility-delta"),
    title: z.string().trim().min(1),
    target: z.string().trim().min(1).describe("Where the facts belong once verified: '[[note]]' or a folder like 'pvsi/signals'"),
    captured: factsInput.min(1).describe("One fact per bullet; cite symbols, not line numbers; [[note]] links, never .md paths"),
    assumptions: factsInput.default([]),
    toFill: factsInput.default([]).describe("What still needs checking"),
  }),
  async run(context, input) {
    const captured = await context.powerloom.captureDraft(input.vault, { ...input, source: `session finding: powerloom ${context.actor}` });

    if (captured.ok && !captured.value.ok) {
      return { ok: false, error: `Not saved, fix and retry: ${captured.value.errors.join(" ")}` };
    }

    return captured;
  },
};
