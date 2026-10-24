import { pipelineStatus } from "@powerloom/db";
import { z } from "zod";
import { listBacklogRows, toBacklogListRow } from "../backlog/backlogList";
import { loadBacklogRows, loadLastSyncedAt } from "../backlog/backlogRows";
import type { BacklogListRow } from "../models/BacklogListRow";
import type { Command } from "../models/Command";
import { limitInput, vaultInput } from "./inputs";

const input = z.object({
  vault: vaultInput,
  status: z.enum(pipelineStatus.enumValues).optional().describe("Only PBIs in this pipeline status, e.g. ready-for-dev"),
  search: z.string().trim().min(1).optional().describe("A substring of the title (any case) or of the id"),
  limit: limitInput(200, 50),
});

type ListPbisInput = z.infer<typeof input>;

interface ListPbisValue {
  lastSyncedAt: Date | null;
  pbis: BacklogListRow[];
}

export const listPbisCommand: Command<ListPbisInput, ListPbisValue> = {
  name: "pbi.list",
  effect: "read",
  description: "List a vault's PBIs as the Backlog page does: newest change first, a child item after its parent, with what waits on you per PBI. Filter by pipeline status or a search term; pass an adoId to pbi_get or pbi_read for one PBI.",
  input,
  async run(context, input) {
    const rows = await loadBacklogRows(context.db, input.vault);
    const lastSyncedAt = await loadLastSyncedAt(context.db, input.vault);
    const pbis = listBacklogRows(rows, input).slice(0, input.limit).map(toBacklogListRow);

    return { ok: true, value: { lastSyncedAt, pbis } };
  },
};
