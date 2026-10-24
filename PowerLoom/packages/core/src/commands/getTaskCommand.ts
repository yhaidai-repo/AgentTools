import { z } from "zod";
import type { Command } from "../models/Command";
import type { ItemDetail } from "../models/ItemDetail";
import { loadItemDetail } from "../tasks/itemDetail";
import { vaultInput } from "./inputs";

const input = z.object({
  id: z.string().trim().min(1).describe("The item's id as the pages show it: RT-38519-003, Q-38519-001, HT-…, F-…, AT-…, DT-…"),
  vault: vaultInput,
});

type GetTaskInput = z.infer<typeof input>;

export const getTaskCommand: Command<GetTaskInput, ItemDetail> = {
  name: "task.get",
  effect: "read",
  description: "Read one task, question or finding by its id: its body and data (held-by reasons, resolution, answers), its uploads (without bytes), the findings it raised and its runs with their outputs. Pass a run's id to run.get for its trace.",
  input,
  async run(context, input) {
    const detail = await loadItemDetail(context.db, input.id);

    if (!detail) {
      return { ok: false, error: `${input.id} isn't in PowerLoom.` };
    }

    if (detail.item.vault !== input.vault) {
      return { ok: false, error: `${input.id} isn't in vault ${input.vault}: it belongs to ${detail.item.vault}.` };
    }

    return { ok: true, value: detail };
  },
};
