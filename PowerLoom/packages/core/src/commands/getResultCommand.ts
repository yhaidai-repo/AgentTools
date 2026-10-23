import { z } from "zod";
import type { Command } from "../models/Command";
import type { ResultKind } from "../models/ResultKind";
import type { ResultRead } from "../models/ResultRead";
import { vaultInput } from "./inputs";
import { loadResult, resultOwner } from "../results/resultContent";
import { RESULT_KIND_NAMES } from "../results/resultLinks";
import { resultVault } from "../results/resultVault";

const input = z.object({
  kind: z.enum(RESULT_KIND_NAMES).describe("Where the result is stored: refinement, design, estimate, item (a research result or test report), review (a review run) or run (what one run wrote)"),
  id: z.string().trim().min(1).describe("The result's id as result.versions lists it: a row id (refinement, design, estimate, run), an item id (RR-…, TR-…) or a review run's id"),
  vault: vaultInput,
});

// A result is read in its vault's scope the way its page is (user decision 2026-10-18): through its owner task or
// PBI, or its pull request for a review run.
export const getResultCommand: Command<{ kind: ResultKind; id: string; vault: string }, ResultRead> = {
  name: "result.get",
  effect: "read",
  description: "Read one agent result in full: a refinement, design or estimate version, a research result or test report, a review run (its summary and comments) or a run result, with the PBI and task it belongs to. Get the kind and id from result.versions.",
  input,
  async run(context, input) {
    const result = await loadResult(context.db, input.kind, input.id);

    if (!result) {
      return { ok: false, error: `There is no ${input.kind} result ${input.id}.` };
    }

    const owner = await resultOwner(context.db, result);
    const vault = await resultVault(context.db, result, owner);

    if (vault !== input.vault) {
      return { ok: false, error: `The ${input.kind} result ${input.id} isn't in vault ${input.vault}.` };
    }

    return { ok: true, value: { ...result, owner } };
  },
};
