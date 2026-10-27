import { listTrash, type TrashEntry } from "@powerloom/vault";
import { z } from "zod";
import type { Command } from "../models/Command";
import { mountedVaultRoot } from "../vaultPage/vaultRoot";
import { vaultInput } from "./inputs";

// The Maintenance tab's trash: the notes the vault review removed, to restore or delete for good.
export const listVaultTrashCommand: Command<{ vault: string }, TrashEntry[]> = {
  name: "vault.trash",
  effect: "read",
  description: "List a docs vault's trash (.trash/): the notes the vault review removed, with their path in the vault, size and when they were last changed, newest first.",
  input: z.object({ vault: vaultInput }),
  async run(context, input) {
    const root = await mountedVaultRoot(input.vault, context.db);

    if (!root.ok) {
      return root;
    }

    return { ok: true, value: await listTrash(root.value) };
  },
};
