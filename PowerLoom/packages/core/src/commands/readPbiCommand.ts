import { z } from "zod";
import type { Command } from "../models/Command";
import type { PbiReadResult } from "../models/PbiReadResult";
import { readPbiReference } from "../pbiContext/readPbiReference";

// One tool for agents (read_pbi) and chats (pbi_read on the MCP server) alike (user decision 2026-10-13): the same prepared PBI
// context, and any reference it lists.
export const readPbiCommand: Command<{ ref: string }, PbiReadResult> = {
  name: "pbi.read",
  effect: "read",
  description: "Read a PBI's full context as the agents get it (PBI-<id>: ADO fields, note, the user's notes, parent, links, attachments, questions with answers, and every related reference), or any reference it lists: PBI-<id>:refinement, PBI-<id>:design, PBI-<id>:estimate (the latest from any agent), an item id (e.g. Q-123-001, AT-123-002, F-12, RR-123-001), DRAFT-<n>, an upload ATT-<n>, or an Azure DevOps test case TC-<id>.",
  input: z.object({ ref: z.string().trim().min(1).describe("The reference as listed, e.g. PBI-123 or PBI-123:design") }),
  async run(context, input) {
    const read = await readPbiReference(context.db, context.backlogMount, input.ref);

    return read.ok ? { ok: true, value: { ref: input.ref, text: read.value } } : read;
  },
};
