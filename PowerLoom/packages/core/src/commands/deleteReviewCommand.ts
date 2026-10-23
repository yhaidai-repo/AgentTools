import { z } from "zod";
import type { Command } from "../models/Command";

export const deleteReviewCommand: Command<{ prId: number }, { prId: number; title: string }> = {
  name: "review.delete",
  effect: "destructive",
  description: "Delete a pull request's review from PowerLoom only (the PR mirror, comments, review tasks and runs); the pull request check won't list the PR again. ADO is not changed. Refused while the agent reviews it. Confirm with the user first, naming the pull request, as the page's dialog does.",
  input: z.object({ prId: z.number().int().positive() }),
  async run(context, input) {
    const deleted = await context.powerloom.deleteReview(input.prId);

    return deleted.ok ? { ok: true, value: { prId: input.prId, title: deleted.value } } : deleted;
  },
};
