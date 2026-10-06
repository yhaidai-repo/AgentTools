import { z } from "zod";
import type { Command } from "../models/Command";
import { deleteReviewData } from "../reviewAdmin";

export const deleteReviewCommand: Command<{ prId: number }, { prId: number; title: string }> = {
  name: "review.delete",
  description: "Delete a pull request's review from adoa only (the PR mirror, comments, review tasks and runs); the pull request check won't list the PR again. ADO is not changed. Refused while the agent reviews it.",
  input: z.object({ prId: z.number().int().positive() }),
  async run(context, input) {
    const deleted = await deleteReviewData(context.db, input.prId);

    return deleted.ok ? { ok: true, value: { prId: input.prId, title: deleted.value } } : deleted;
  },
};
