import { z } from "zod";
import type { Command } from "../models/Command";
import { readLogEntriesAbout } from "../logs/logEntries";
import { logEntryView } from "../logs/logEntryView";
import type { ItemDetail } from "../models/ItemDetail";
import type { LogEntryView } from "../models/LogEntryView";
import { loadItemDetail } from "../tasks/itemDetail";
import { vaultInput } from "./inputs";

const input = z.object({
  id: z.string().trim().min(1).describe("The item's id as the pages show it: RT-38519-003, Q-38519-001, HT-…, F-…, AT-…, DT-…"),
  vault: vaultInput,
});

type GetTaskInput = z.infer<typeof input>;

// What the error log holds about the task (a failure before a run started), over its retention.
const ERRORS_SINCE_MS = 14 * 24 * 60 * 60 * 1000;

export const getTaskCommand: Command<GetTaskInput, ItemDetail & { errors: LogEntryView[] }> = {
  name: "task.get",
  effect: "read",
  description: "Read one task, question or finding by its id: its body and data (held-by reasons, resolution, answers), its uploads (without bytes), the findings it raised, its runs with their outputs, and the errors logged about it (e.g. a failure before a run could start). Pass a run's id to run_get for its trace.",
  input,
  async run(context, input) {
    const detail = await loadItemDetail(context.db, input.id);

    if (!detail) {
      return { ok: false, error: `${input.id} isn't in PowerLoom.` };
    }

    if (detail.item.vault !== input.vault) {
      return { ok: false, error: `${input.id} isn't in vault ${input.vault}: it belongs to ${detail.item.vault}.` };
    }

    const errors = await readLogEntriesAbout(context.db, { taskId: detail.item.id }, new Date(Date.now() - ERRORS_SINCE_MS));

    return { ok: true, value: { ...detail, errors: errors.map(logEntryView) } };
  },
};
