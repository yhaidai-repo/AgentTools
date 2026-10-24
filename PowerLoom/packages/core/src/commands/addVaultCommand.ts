import { z } from "zod";
import type { AddedVault } from "../models/AddedVault";
import type { Command } from "../models/Command";
import { mapOutcome } from "./mapOutcome";

// The Vaults dialog's Add: PowerLoom prepares the folder from its templates and writes the vault's MCP entries.
export const addVaultCommand: Command<{ folder: string }, AddedVault> = {
  name: "vault.add",
  description: "Add a folder under the vaults root as a PowerLoom vault: PowerLoom prepares it from its templates (AGENTS.md, POWERLOOM.md, draft/, the MCP entries) without touching existing notes, and adds the vault review schedule; its features start off. Ask the user for the folder's path on this PC; never guess it.",
  input: z.object({ folder: z.string().trim().min(1).describe("The folder's path on the PC, under the vaults root, e.g. D:/Claude/work-projects") }),
  async run(context, input) {
    return mapOutcome(await context.powerloom.addVault(input.folder), (added) => added);
  },
};
