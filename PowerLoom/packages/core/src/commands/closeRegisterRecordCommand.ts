import { z } from "zod";
import type { Command } from "../models/Command";
import { vaultInput } from "./inputs";
import { mapOutcome } from "./mapOutcome";
import type { RecordWorkContext } from "@powerloom/vault";
import { recordContextFields, recordContextInput } from "./recordContext";

// The person who settles a record in a chat, as the record's Decision line names them.
const DECIDED_BY = "the user in a chat";

// close_record for a chat (stage 5, MCPQ-008): written at once, the way the vault review closes one.
export const closeRegisterRecordCommand: Command<{ vault: string; path: string; id: string; status: "fixed" | "resolved" | "duplicate"; duplicateOf: { path: string; id: string } | null; decision: string; context?: RecordWorkContext }, { path: string; id: string; status: string }> = {
  name: "register.close",
  effect: "destructive",
  description: "Close an open register record (KI, OQ or WWW) the user settled: fixed (known issues only), resolved (answered, decided or fixed), or duplicate (name the record it repeats). Written as the vault rules say: [RESOLVED] in the heading, the status, Updated and a Decision line (WWW: Status resolved and the decision in Resolution). Heading links to it in other notes are pointed at the register by the next vault review. Confirm with the user first, naming the record and the decision.",
  input: z.object({
    context: recordContextInput,
    vault: vaultInput,
    path: z.string().trim().min(1).describe("The register note, relative to the vault root, as vault_registers shows it (www-log.md, shop/shop-known-issues.md)"),
    id: z.string().trim().min(1).describe("The record id, e.g. KI-008, OQ-003, WWW-005"),
    status: z.enum(["fixed", "resolved", "duplicate"]),
    duplicateOf: z.object({ path: z.string().trim().min(1), id: z.string().trim().min(1) }).nullable().default(null).describe("Duplicate only: the record it repeats (register path and id)"),
    decision: z.string().trim().min(1).describe("One line written into the record: what settled it, with the dates, PBIs or commits"),
  }),
  async run(context, input) {
    const { vault, ...closing } = input;

    return mapOutcome(await context.powerloom.closeRegisterRecord(vault, { ...closing, ...recordContextFields(context, input.context), decidedBy: DECIDED_BY }), (closed) => closed);
  },
};
