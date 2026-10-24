import { z } from "zod";
import type { Command } from "../models/Command";

export const closePbiCommand: Command<{ adoId: number }, { message: string }> = {
  name: "pbi.close",
  effect: "destructive",
  description: "Close a PBI in PowerLoom only (e.g. it went to another team member): it stays for the agents to read, its open items but findings are cancelled and its open child items close with it; the sync keeps it closed until pbi.reopen. ADO is not changed. Refused while an agent runs on it. Confirm with the user first, naming the PBI, as the page's dialog does.",
  input: z.object({ adoId: z.number().int().positive() }),
  async run(context, input) {
    const closed = await context.powerloom.closePbi(input.adoId, context.actor);

    return closed.ok ? { ok: true, value: { message: closed.value } } : closed;
  },
};
